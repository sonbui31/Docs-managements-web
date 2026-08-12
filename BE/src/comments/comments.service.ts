import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { CollaborationService } from "../collaboration/collaboration.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly collaboration: CollaborationService
  ) {}

  async findByDocument(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);

    const comments = await this.prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });

    return this.withAuthorProfiles(comments);
  }

  async create(dto: CreateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);

    const authorName = user.name || user.email || "User";

    const comment = await this.prisma.comment.create({
      data: {
        ...dto,
        createdBy: authorName,
        createdByEmail: user.email
      }
    });
    await this.collaboration.log(
      user,
      dto.parentId ? "COMMENT_REPLIED" : "COMMENT_CREATED",
      "Document",
      dto.documentId,
      { commentId: comment.id, projectId: await this.projectIdForDocument(dto.documentId), blockId: dto.blockId }
    );
    await this.collaboration.notifyDocumentParticipants(
      dto.documentId,
      dto.parentId ? "Có phản hồi nhận xét mới" : "Có nhận xét mới",
      `${authorName}: ${dto.content.slice(0, 120)}`,
      user.id
    );
    return this.withAuthorProfile(comment);
  }

  async resolve(id: string, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);

    const resolvedAt = new Date();
    const comment = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedAt,
          resolvedBy: user.id
        }
      });

      await tx.comment.updateMany({
        where: { parentId: id },
        data: {
          status: "RESOLVED",
          resolvedAt
        }
      });

      return comment;
    });
    await this.collaboration.log(
      user,
      "COMMENT_RESOLVED",
      "Document",
      comment.documentId,
      { commentId: id, projectId: await this.projectIdForDocument(comment.documentId) }
    );
    return this.withAuthorProfile(comment);
  }

  async update(id: string, dto: UpdateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No comment fields to update");
    }

    const comment = await this.prisma.comment.update({
      where: { id },
      data: {
        content: dto.content?.trim(),
        selectedText: dto.selectedText?.trim(),
        blockId: dto.blockId?.trim()
      }
    });
    await this.collaboration.log(
      user,
      "COMMENT_UPDATED",
      "Document",
      comment.documentId,
      { commentId: id, projectId: await this.projectIdForDocument(comment.documentId) }
    );
    return this.withAuthorProfile(comment);
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);

    const comment = await this.prisma.comment.findUnique({ where: { id }, select: { documentId: true } });
    await this.prisma.comment.deleteMany({
      where: {
        OR: [{ id }, { parentId: id }]
      }
    });
    if (comment) {
      await this.collaboration.log(
        user,
        "COMMENT_DELETED",
        "Document",
        comment.documentId,
        { commentId: id, projectId: await this.projectIdForDocument(comment.documentId) }
      );
    }

    return { ok: true };
  }

  private async projectIdForDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { projectId: true } });
    return document?.projectId ?? null;
  }

  private async withAuthorProfiles<T extends Array<{ createdBy: string | null; createdByEmail?: string | null }>>(comments: T) {
    const emails = Array.from(
      new Set(
        comments
          .map((comment) => comment.createdByEmail || comment.createdBy)
          .filter((value): value is string => typeof value === "string" && value.includes("@"))
          .map((email) => email.trim().toLowerCase())
      )
    );
    if (!emails.length) return comments;

    const users = await this.prisma.user.findMany({
      where: { email: { in: emails }, deletedAt: null },
      select: { email: true, name: true }
    });
    const usersByEmail = new Map(users.map((profile) => [profile.email.toLowerCase(), profile]));

    return comments.map((comment) => {
      const email = (comment.createdByEmail || (comment.createdBy?.includes("@") ? comment.createdBy : null))?.trim().toLowerCase();
      const profile = email ? usersByEmail.get(email) : null;
      if (!profile) return comment;
      return {
        ...comment,
        createdBy: profile.name,
        createdByEmail: profile.email
      };
    });
  }

  private async withAuthorProfile<T extends { createdBy: string | null; createdByEmail?: string | null }>(comment: T) {
    const [profiled] = await this.withAuthorProfiles([comment]);
    return profiled;
  }
}
