import { BadRequestException, Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../auth/auth.types";
import { CollaborationService } from "../collaboration/collaboration.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly collaboration: CollaborationService,
    private readonly notifications: NotificationsService
  ) {}

  async findByDocument(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);

    const comments = await this.prisma.comment.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });

    return this.withAuthorProfiles(comments);
  }

  async context(id: string, user: AuthenticatedUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { document: { select: { id: true, projectId: true, title: true } } }
    });
    if (!comment) {
      throw new BadRequestException("Comment not found");
    }
    await this.permissions.assertDocumentRole(user, comment.documentId, ["VIEWER"]);
    return {
      id: comment.id,
      parentId: comment.parentId,
      documentId: comment.documentId,
      projectId: comment.document.projectId,
      blockId: comment.blockId,
      selectedText: comment.selectedText,
      document: comment.document
    };
  }

  async create(dto: CreateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);

    const authorName = user.name || user.email || "User";
    const projectId = await this.projectIdForDocument(dto.documentId);

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
      { commentId: comment.id, projectId, blockId: dto.blockId }
    );
    await this.notifyForCreatedComment(dto, user, authorName, projectId, comment.id);
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
    await this.notifyForResolvedComment(id, comment.documentId, user);
    return this.withAuthorProfile(comment);
  }

  async update(id: string, dto: UpdateCommentDto, user: AuthenticatedUser) {
    await this.permissions.assertCommentRole(user, id, ["REVIEWER", "EDITOR", "MANAGER"]);
    await this.assertCommentOwner(id, user, "Bạn chỉ có thể sửa comment do chính mình tạo");
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
    await this.assertCommentOwner(id, user, "Bạn chỉ có thể xóa comment do chính mình tạo");
    await this.assertNoOtherUserReplies(id, user);

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

  private async assertCommentOwner(id: string, user: AuthenticatedUser, message: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { createdBy: true, createdByEmail: true }
    });
    const isOwner =
      comment?.createdByEmail === user.email ||
      comment?.createdBy === user.email ||
      comment?.createdBy === user.name;
    if (!isOwner) throw new BadRequestException(message);
  }

  private async assertNoOtherUserReplies(parentId: string, user: AuthenticatedUser) {
    const otherUserReplies = await this.prisma.comment.count({
      where: {
        parentId,
        NOT: {
          OR: [
            { createdByEmail: user.email },
            { createdBy: user.email },
            { createdBy: user.name }
          ]
        }
      }
    });
    if (otherUserReplies > 0) {
      throw new BadRequestException("Không thể xóa comment này vì đang có reply của người khác");
    }
  }

  private async projectIdForDocument(documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { projectId: true } });
    return document?.projectId ?? null;
  }

  private async notifyForCreatedComment(
    dto: CreateCommentDto,
    user: AuthenticatedUser,
    authorName: string,
    projectId: string | null,
    commentId: string
  ) {
    const mentionedUsers = await this.notifications.mentionedUsers(dto.content);
    const mentionedIds = mentionedUsers.map((mentionedUser) => mentionedUser.id);
    const mentionedIdSet = new Set(mentionedIds);
    const emailUrl = this.notifications.entityUrl({ projectId, documentId: dto.documentId });

    if (dto.parentId) {
      const replyRecipientIds = await this.replyRecipientIds(dto.parentId);
      await this.notifications.createForUsers({
        userIds: replyRecipientIds.filter((userId) => !mentionedIdSet.has(userId)),
        actor: user,
        title: "Có phản hồi nhận xét mới",
        message: `${authorName}: ${dto.content.slice(0, 120)}`,
        entityType: "DocumentComment",
        entityId: commentId,
        emailUrl
      });
    } else {
      const commentRecipientIds = await this.newCommentRecipientIds(dto.documentId);
      await this.notifications.createForUsers({
        userIds: commentRecipientIds.filter((userId) => !mentionedIdSet.has(userId)),
        actor: user,
        title: "Có nhận xét mới",
        message: `${authorName}: ${dto.content.slice(0, 120)}`,
        entityType: "DocumentComment",
        entityId: commentId,
        emailUrl
      });
    }

    await this.notifications.createForUsers({
      userIds: mentionedIds,
      actor: user,
      title: "Bạn được nhắc đến trong tài liệu",
      message: `${authorName} đã nhắc đến bạn trong một nhận xét.`,
      entityType: "DocumentComment",
      entityId: commentId,
      emailUrl
    });
  }

  private async newCommentRecipientIds(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        createdByEmail: true,
        permissions: { select: { userId: true } }
      }
    });
    if (!document) return [];

    const owner = document.createdByEmail
      ? await this.prisma.user.findFirst({
          where: { email: document.createdByEmail, deletedAt: null, status: "ACTIVE" },
          select: { id: true }
        })
      : null;

    return this.uniqueIds([
      owner?.id,
      ...document.permissions.map((permission) => permission.userId)
    ]);
  }

  private async replyRecipientIds(parentId: string) {
    const parent = await this.prisma.comment.findUnique({
      where: { id: parentId },
      select: { createdByEmail: true }
    });
    if (!parent) return [];

    return this.userIdsByEmails([parent.createdByEmail]);
  }

  private async notifyForResolvedComment(commentId: string, documentId: string, user: AuthenticatedUser) {
    const projectId = await this.projectIdForDocument(documentId);
    const thread = await this.prisma.comment.findMany({
      where: { OR: [{ id: commentId }, { parentId: commentId }] },
      select: { createdByEmail: true }
    });
    const recipientIds = await this.userIdsByEmails(thread.map((comment) => comment.createdByEmail));

    await this.notifications.createForUsers({
      userIds: recipientIds,
      actor: user,
      title: "Nhận xét đã hoàn thành",
      message: `${user.name || user.email} đã đánh dấu một luồng nhận xét là hoàn thành.`,
      entityType: "DocumentComment",
      entityId: commentId,
      emailUrl: this.notifications.entityUrl({ projectId, documentId })
    });
  }

  private async userIdsByEmails(emails: Array<string | null | undefined>) {
    const normalizedEmails = Array.from(
      new Set(
        emails
          .filter((email): email is string => Boolean(email?.trim()))
          .map((email) => email.trim().toLowerCase())
      )
    );
    if (!normalizedEmails.length) return [];

    const users = await this.prisma.user.findMany({
      where: { email: { in: normalizedEmails }, deletedAt: null, status: "ACTIVE" },
      select: { id: true }
    });

    return this.uniqueIds(users.map((user) => user.id));
  }

  private uniqueIds(ids: Array<string | null | undefined>) {
    return Array.from(new Set(ids.filter((id): id is string => Boolean(id?.trim()))));
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
