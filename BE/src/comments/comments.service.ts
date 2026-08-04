import { Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async findByDocument(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);

    return this.prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(dto: CreateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);

    return this.prisma.comment.create({ data: dto });
  }

  async resolve(id: string, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date()
      }
    });
  }
}
