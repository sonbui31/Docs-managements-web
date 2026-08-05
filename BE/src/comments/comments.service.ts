import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

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

  async update(id: string, dto: UpdateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No comment fields to update");
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        content: dto.content?.trim(),
        selectedText: dto.selectedText?.trim(),
        blockId: dto.blockId?.trim()
      }
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);

    await this.prisma.comment.deleteMany({
      where: {
        OR: [{ id }, { parentId: id }]
      }
    });

    return { ok: true };
  }
}
