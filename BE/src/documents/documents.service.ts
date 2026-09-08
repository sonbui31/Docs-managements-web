import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectRole } from "@prisma/client";
import sanitizeHtml = require("sanitize-html");
import { AuthenticatedUser } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { PublishDocumentVersionDto } from "./dto/publish-document-version.dto";
import { TransferDocumentOwnerDto } from "./dto/transfer-document-owner.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

const documentRoleRank: Record<ProjectRole, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  EDITOR: 3,
  MANAGER: 4
};

const EDIT_SESSION_TIMEOUT_MS = 2 * 60 * 1000;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationsService
  ) {}

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectVisible(user, projectId);

    const [projectMembership, documents] = await Promise.all([
      this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
        select: { role: true, roles: true }
      }),
      this.prisma.document.findMany({
        where: this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"]),
        orderBy: { updatedAt: "desc" },
        include: {
          _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } },
          project: {
            select: {
              externalCompanyId: true,
              externalDepartmentId: true
            }
          },
          permissions: {
            where: { userId: user.id },
            select: { role: true, roles: true },
            take: 1
          },
          editingSession: true
        }
      })
    ]);

    return documents.map((document) => {
      const { permissions, project, ...payload } = document;
      return {
        ...payload,
        effectiveRole: this.highestDocumentRole([
          ...(document.ownerId === user.id ? ["MANAGER" as ProjectRole] : []),
          ...this.storedRoles(projectMembership),
          ...this.storedRoles(permissions[0]),
          ...this.scopedRolesFor(user, {
            externalCompanyId: document.externalCompanyId ?? project.externalCompanyId,
            externalDepartmentId: document.externalDepartmentId ?? project.externalDepartmentId
          })
        ]),
        editingSession: this.activeEditingSessionFor(document, user)
      };
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["VIEWER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      include: {
        comments: { orderBy: { createdAt: "desc" } },
        versions: { orderBy: { createdAt: "desc" } },
        editingSession: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    return {
      ...document,
      effectiveRole: await this.effectiveRoleForDocument(id, document.projectId, user),
      editingSession: this.activeEditingSessionFor(document, user)
    };
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

    const restoredDocument = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return {
      ...restoredDocument,
      effectiveRole: await this.effectiveRoleForDocument(id, restoredDocument.projectId, user),
      editingSession: null
    };
  }

  async publishVersion(id: string, dto: PublishDocumentVersionDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        title: true,
        currentVersion: true,
        htmlContent: true,
        sourceType: true,
        editingSession: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }
    if (document.sourceType === "imported") {
      throw new BadRequestException("Tài liệu import tạo phiên bản bằng cách import lại file.");
    }

    this.assertNoActiveEditorConflict(document.editingSession, user);

    const nextVersion = this.nextVersion(document.currentVersion);
    const changeNote = dto.changeNote?.trim() || "Published version";

    const publishedDocument = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedDocument = await tx.document.update({
        where: { id },
        data: { currentVersion: nextVersion },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: nextVersion,
          htmlContent: document.htmlContent,
          changeNote,
          createdBy: user.name || user.email
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_VERSION_PUBLISHED",
          entityType: "Document",
          entityId: id,
          metadata: {
            projectId: document.projectId,
            title: document.title,
            previousVersion: document.currentVersion,
            newVersion: nextVersion
          }
        }
      });

      return updatedDocument;
    });

    await this.notifications.notifyDocumentParticipants(
      id,
      "Tài liệu có phiên bản mới",
      `${user.name || user.email} đã tạo phiên bản ${nextVersion} cho tài liệu "${publishedDocument.title}".`,
      user
    ).catch((error) => {
      console.warn("Notify document version publish failed:", error);
    });

    return {
      ...publishedDocument,
      effectiveRole: await this.effectiveRoleForDocument(id, publishedDocument.projectId, user),
      editingSession: null
    };
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
          ownerId: user.id,
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

      return { ...document, effectiveRole: "MANAGER", editingSession: null };
    });
  }

  async update(id: string, dto: UpdateDocumentDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No document fields to update");
    }

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        title: true,
        currentVersion: true,
        sourceType: true,
        updatedAt: true,
        editingSession: true
      }
    });
    if (!document) {
      throw new NotFoundException("Document not found");
    }

    const hasContentUpdate = typeof dto.htmlContent === "string";
    if (hasContentUpdate && document.sourceType === "imported") {
      throw new BadRequestException("Tài liệu import không hỗ trợ chỉnh sửa nội dung trực tiếp. Vui lòng import lại file để cập nhật.");
    }
    if (hasContentUpdate) {
      this.assertNoActiveEditorConflict(document.editingSession, user);
      this.assertDocumentNotStale(document, dto, user);
    }

    const cleanHtml = hasContentUpdate ? this.cleanHtml(dto.htmlContent ?? "") : undefined;
    const updatedDocument = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedDocument = await tx.document.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          type: dto.type?.trim(),
          status: dto.status,
          htmlContent: cleanHtml
        },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: hasContentUpdate ? "DOCUMENT_CONTENT_UPDATED" : "DOCUMENT_UPDATED",
          entityType: "Document",
          entityId: id,
          metadata: {
            projectId: document.projectId,
            title: updatedDocument.title,
            version: updatedDocument.currentVersion
          }
        }
      });

      return updatedDocument;
    });

    if (dto.status === "DEPLOYED") {
      await this.notifications.notifyDocumentParticipants(
        id,
        "Tài liệu đã được triển khai",
        `${user.name || user.email} đã triển khai tài liệu "${updatedDocument.title}".`,
        user
      ).catch((error) => {
        console.warn("Notify document deploy failed:", error);
      });
    }

    return {
      ...updatedDocument,
      effectiveRole: await this.effectiveRoleForDocument(id, updatedDocument.projectId, user),
      editingSession: null
    };
  }

  async acquireEditSession(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);

    const document = await this.prisma.document.findUnique({
      where: { id },
      select: { id: true, sourceType: true, editingSession: true }
    });
    if (!document) throw new NotFoundException("Document not found");
    if (document.sourceType === "imported") {
      throw new BadRequestException("Tài liệu import chỉ có thể cập nhật bằng cách import lại file.");
    }

    this.assertNoActiveEditorConflict(document.editingSession, user);
    const editingSession = await this.prisma.documentEditingSession.upsert({
      where: { documentId: id },
      create: this.editingSessionData(id, user),
      update: {
        userId: user.id,
        userName: user.name || user.email,
        userEmail: user.email,
        startedAt: new Date(),
        heartbeatAt: new Date(),
        expiresAt: this.editingSessionExpiry()
      }
    });

    return { editingSession: this.activeEditingSessionFor({ editingSession }, user) };
  }

  async heartbeatEditSession(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);

    const session = await this.prisma.documentEditingSession.findUnique({
      where: { documentId: id }
    });

    this.assertNoActiveEditorConflict(session, user);
    const editingSession = await this.prisma.documentEditingSession.upsert({
      where: { documentId: id },
      create: this.editingSessionData(id, user),
      update: {
        heartbeatAt: new Date(),
        expiresAt: this.editingSessionExpiry()
      }
    });

    return { editingSession: this.activeEditingSessionFor({ editingSession }, user) };
  }

  async releaseEditSession(id: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["EDITOR", "MANAGER"]);

    await this.prisma.documentEditingSession.deleteMany({
      where: { documentId: id, userId: user.id }
    });

    return { ok: true };
  }

  async transferOwner(id: string, dto: TransferDocumentOwnerDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, id, ["MANAGER"]);

    const [document, owner] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id },
        select: { id: true, projectId: true, title: true }
      }),
      this.prisma.user.findFirst({
        where: { id: dto.ownerId, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true, email: true }
      })
    ]);

    if (!document) throw new NotFoundException("Document not found");
    if (!owner) throw new NotFoundException("Owner not found");

    const updatedDocument = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.document.update({
        where: { id },
        data: {
          ownerId: owner.id,
          createdBy: owner.name || owner.email,
          createdByEmail: owner.email
        },
        include: { _count: { select: { comments: { where: { status: "OPEN", parentId: null } }, versions: true } } }
      });

      await tx.documentPermission.upsert({
        where: { documentId_userId: { documentId: id, userId: owner.id } },
        create: {
          documentId: id,
          projectId: document.projectId,
          userId: owner.id,
          role: "MANAGER",
          roles: ["MANAGER"],
          assignedBy: user.id
        },
        update: {
          role: "MANAGER",
          roles: ["MANAGER"],
          assignedBy: user.id
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "DOCUMENT_OWNER_TRANSFERRED",
          entityType: "Document",
          entityId: id,
          metadata: { projectId: document.projectId, ownerId: owner.id, ownerEmail: owner.email, title: document.title }
        }
      });

      return updated;
    });

    return {
      ...updatedDocument,
      effectiveRole: await this.effectiveRoleForDocument(id, updatedDocument.projectId, user),
      editingSession: null
    };
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
        "*": ["data-block-id", "data-source", "data-page", "data-color", "class", "style", "id", "aria-label"],
        img: ["src", "alt", "width", "height", "loading", "class"],
        iframe: ["src", "title", "loading", "class"]
      },
      allowedStyles: {
        "*": {
          color: [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
          "background-color": [/^#[0-9a-fA-F]{3,8}$/, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
          "text-align": [/^(left|center|right|justify)$/],
          "font-family": [/^[a-zA-Z0-9\s,"'-]+$/],
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

  private highestDocumentRole(roles: ProjectRole[]) {
    if (!roles.length) return null;
    return roles.reduce((highest, role) => (documentRoleRank[role] > documentRoleRank[highest] ? role : highest), roles[0]);
  }

  private async effectiveRoleForDocument(documentId: string, projectId: string, user: AuthenticatedUser) {
    const [document, projectMembership, documentPermission] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id: documentId },
        select: {
          ownerId: true,
          externalCompanyId: true,
          externalDepartmentId: true,
          project: {
            select: {
              externalCompanyId: true,
              externalDepartmentId: true
            }
          }
        }
      }),
      this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
        select: { role: true, roles: true }
      }),
      this.prisma.documentPermission.findUnique({
        where: { documentId_userId: { documentId, userId: user.id } },
        select: { role: true, roles: true }
      })
    ]);

    if (!document) return null;
    return this.highestDocumentRole([
      ...(document.ownerId === user.id ? ["MANAGER" as ProjectRole] : []),
      ...this.storedRoles(projectMembership),
      ...this.storedRoles(documentPermission),
      ...this.scopedRolesFor(user, {
        externalCompanyId: document.externalCompanyId ?? document.project.externalCompanyId,
        externalDepartmentId: document.externalDepartmentId ?? document.project.externalDepartmentId
      })
    ]);
  }

  private storedRoles(permission?: { role: ProjectRole; roles?: ProjectRole[] | null } | null) {
    if (!permission) return [];
    return permission.roles?.length ? permission.roles : [permission.role];
  }

  private scopedRolesFor(
    user: AuthenticatedUser,
    scope: { externalCompanyId: string | null; externalDepartmentId: string | null }
  ): ProjectRole[] {
    if (!scope.externalCompanyId || !user.externalCompanyId) {
      return user.role === "ADMIN" ? ["MANAGER"] : [];
    }
    if (scope.externalCompanyId !== user.externalCompanyId) return [];
    if (user.role === "ADMIN") return ["MANAGER"];

    const sameDepartment =
      !scope.externalDepartmentId ||
      (Boolean(user.externalDepartmentId) && scope.externalDepartmentId === user.externalDepartmentId);
    if (sameDepartment && user.role === "MANAGER") return ["MANAGER"];
    return [];
  }

  private editingSessionExpiry() {
    return new Date(Date.now() + EDIT_SESSION_TIMEOUT_MS);
  }

  private editingSessionData(documentId: string, user: AuthenticatedUser) {
    const now = new Date();
    return {
      documentId,
      userId: user.id,
      userName: user.name || user.email,
      userEmail: user.email,
      startedAt: now,
      heartbeatAt: now,
      expiresAt: new Date(now.getTime() + EDIT_SESSION_TIMEOUT_MS)
    };
  }

  private activeEditingSessionFor(
    source: {
      editingSession?: {
        userId: string;
        userName: string;
        userEmail: string;
        startedAt: Date;
        heartbeatAt: Date;
        expiresAt: Date;
      } | null;
    },
    user: AuthenticatedUser
  ) {
    const session = source.editingSession;
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    return {
      userId: session.userId,
      userName: session.userName,
      userEmail: session.userEmail,
      startedAt: session.startedAt,
      heartbeatAt: session.heartbeatAt,
      expiresAt: session.expiresAt,
      isCurrentUser: session.userId === user.id
    };
  }

  private assertNoActiveEditorConflict(
    session: {
      userId: string;
      userName: string;
      userEmail: string;
      startedAt: Date;
      heartbeatAt: Date;
      expiresAt: Date;
    } | null | undefined,
    user: AuthenticatedUser
  ) {
    if (!session || session.userId === user.id || session.expiresAt.getTime() <= Date.now()) return;
    throw new ConflictException({
      message: `${session.userName || session.userEmail} đang chỉnh sửa tài liệu này.`,
      code: "DOCUMENT_EDIT_SESSION_ACTIVE",
      editingSession: {
        userId: session.userId,
        userName: session.userName,
        userEmail: session.userEmail,
        startedAt: session.startedAt,
        heartbeatAt: session.heartbeatAt,
        expiresAt: session.expiresAt,
        isCurrentUser: false
      }
    });
  }

  private assertDocumentNotStale(
    document: {
      updatedAt: Date;
      currentVersion: string;
      editingSession?: {
        userId: string;
        userName?: string | null;
        userEmail?: string | null;
        startedAt: Date;
        heartbeatAt: Date;
        expiresAt: Date;
      } | null;
    },
    dto: Pick<UpdateDocumentDto, "expectedUpdatedAt" | "expectedVersion">,
    user?: AuthenticatedUser
  ) {
    if (dto.expectedVersion && dto.expectedVersion !== document.currentVersion) {
      throw new ConflictException({
        message: "Tài liệu đã có phiên bản mới hơn. Vui lòng tải lại trước khi lưu.",
        code: "DOCUMENT_VERSION_CONFLICT",
        currentVersion: document.currentVersion
      });
    }

    if (
      user &&
      document.editingSession &&
      document.editingSession.userId === user.id &&
      new Date(document.editingSession.expiresAt).getTime() > Date.now()
    ) {
      return;
    }

    if (!dto.expectedUpdatedAt) return;
    const expectedTime = new Date(dto.expectedUpdatedAt).getTime();
    if (!Number.isFinite(expectedTime)) return;
    if (Math.abs(document.updatedAt.getTime() - expectedTime) > 5000) {
      throw new ConflictException({
        message: "Tài liệu đã được người khác cập nhật. Vui lòng tải lại trước khi lưu.",
        code: "DOCUMENT_UPDATE_CONFLICT",
        updatedAt: document.updatedAt
      });
    }
  }
}
