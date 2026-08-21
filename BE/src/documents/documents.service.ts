import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import sanitizeHtml = require("sanitize-html");
import { AuthenticatedUser } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService
  ) {}

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectVisible(user, projectId);

    return this.prisma.document.findMany({
      where: this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]),
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: "desc" } },
        versions: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return document;
  }

  async versions(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      select: {
        id: true,
        documentId: true,
        version: true,
        changeNote: true,
        createdBy: true,
        createdAt: true
      }
    });
  }

  async restoreVersion(id: string, versionId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, projectId: true, title: true, currentVersion: true }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId: id }
    });

    if (!version) {
      throw new NotFoundException("Document version not found");
    }

    const nextVersion = this.nextVersion(document.currentVersion);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedDocument = await tx.document.update({
        where: { id },
        data: {
          currentVersion: nextVersion,
          htmlContent: version.htmlContent
        },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: nextVersion,
          htmlContent: version.htmlContent,
          changeNote: `Restored from ${version.version}`,
          createdBy: user.name || user.email
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_VERSION_RESTORED",
          entityType: "Document",
          entityId: id,
          metadata: {
            projectId: document.projectId,
            restoredVersion: version.version,
            newVersion: nextVersion,
            title: document.title
          }
        }
      });

      return updatedDocument;
    });
  }

  async create(dto: CreateDocumentDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, dto.projectId, ["EDITOR", "MANAGER"]);

    const cleanHtml = this.cleanHtml(dto.htmlContent);
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { externalCompanyId: true, externalDepartmentId: true }
    });

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const document = await tx.document.create({
        data: {
          projectId: dto.projectId,
          title: dto.title,
          type: dto.type,
          htmlContent: cleanHtml,
          sourceType: dto.sourceType ?? "manual",
          sourceFileName: dto.sourceFileName,
          externalCompanyId: project?.externalCompanyId ?? user.externalCompanyId ?? null,
          externalDepartmentId: project?.externalDepartmentId ?? user.externalDepartmentId ?? null,
          createdBy: user.name || user.email,
          createdByEmail: user.email
        }
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: document.currentVersion,
          htmlContent: cleanHtml,
          changeNote: "Initial version",
          createdBy: user.name || user.email
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_CREATED",
          entityType: "Document",
          entityId: document.id,
          metadata: { projectId: dto.projectId, title: dto.title }
        }
      });

      return document;
    });
  }

  async update(id: string, dto: UpdateDocumentDto, user: AuthenticatedUser) {
    const document = await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No document fields to update");
    }

    const cleanHtml = dto.htmlContent ? this.cleanHtml(dto.htmlContent) : undefined;

    const updatedDocument = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedDocument = await tx.document.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          type: dto.type?.trim(),
          status: dto.status,
          currentVersion: dto.currentVersion?.trim(),
          htmlContent: cleanHtml
        },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      if (cleanHtml) {
        await tx.documentVersion.upsert({
          where: { documentId_version: { documentId: id, version: updatedDocument.currentVersion } },
          create: {
            documentId: id,
            version: updatedDocument.currentVersion,
            htmlContent: cleanHtml,
            changeNote: dto.changeNote ?? "Updated content",
            createdBy: user.name || user.email
          },
          update: {
            htmlContent: cleanHtml,
            changeNote: dto.changeNote ?? "Updated content",
            createdBy: user.name || user.email
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_UPDATED",
          entityType: "Document",
          entityId: id,
          metadata: { projectId: document.projectId, title: updatedDocument.title }
        }
      });

      return updatedDocument;
    });

    if (dto.status === "DEPLOYED" || cleanHtml) {
      await this.notifications.notifyDocumentParticipants(
        id,
        dto.status === "DEPLOYED" ? "Tài liệu đã được triển khai" : "Tài liệu vừa được cập nhật",
        `${user.name || user.email} đã ${dto.status === "DEPLOYED" ? "triển khai" : "cập nhật"} tài liệu "${updatedDocument.title}".`,
        user
      );
    }

    return updatedDocument;
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["MANAGER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, projectId: true, title: true }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_DELETED",
          entityType: "Project",
          entityId: document.projectId,
          metadata: { projectId: document.projectId, documentId: id, title: document.title }
        }
      });
      await tx.document.delete({ where: { id } });
    });
    return { ok: true };
  }

  private cleanHtml(html: string) {
    return sanitizeHtml(html, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "h1",
        "h2",
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "section",
        "article",
        "figure",
        "figcaption",
        "span",
        "iframe"
      ]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["data-block-id", "data-source", "data-page", "class", "style", "id", "aria-label"],
        img: ["src", "alt", "width", "height", "loading", "class"],
        iframe: ["src", "title", "loading", "class"]
      },
      allowedStyles: {
        "*": {
          left: [/^\d+(\.\d+)?px$/],
          top: [/^-?\d+(\.\d+)?px$/],
          width: [/^\d+(\.\d+)?px$/],
          height: [/^\d+(\.\d+)?px$/],
          "font-size": [/^\d+(\.\d+)?px$/]
        }
      },
      allowedSchemesByTag: {
        img: ["http", "https", "data"],
        iframe: ["http", "https"]
      }
    });
  }

  private nextVersion(version: string) {
    const match = version.match(/^v?(\d+)(?:\.(\d+))?$/i);
    if (!match) return `v${Date.now()}`;
    const major = Number(match[1] ?? 0);
    const minor = Number(match[2] ?? 0);
    return `v${major}.${minor + 1}`;
  }
}
