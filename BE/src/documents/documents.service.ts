import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import sanitizeHtml = require("sanitize-html");
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDocumentDto } from "./dto/create-document.dto";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);

    return this.prisma.document.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { comments: true, versions: true } } }
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

  async create(dto: CreateDocumentDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, dto.projectId, ["EDITOR", "MANAGER"]);

    const cleanHtml = sanitizeHtml(dto.htmlContent, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "table", "thead", "tbody", "tr", "th", "td"]),
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        "*": ["data-block-id", "class"],
        img: ["src", "alt", "width", "height"]
      }
    });

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const document = await tx.document.create({
        data: {
          projectId: dto.projectId,
          title: dto.title,
          type: dto.type,
          htmlContent: cleanHtml,
          sourceType: dto.sourceType ?? "manual",
          sourceFileName: dto.sourceFileName
        }
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          version: document.currentVersion,
          htmlContent: cleanHtml,
          changeNote: "Initial version"
        }
      });

      return document;
    });
  }
}
