import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectRole, WorkItemPriority, WorkItemStatus, WorkItemType } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CollaborationService } from "../collaboration/collaboration.service";
import { MediaService } from "../media/media.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWorkItemDto } from "./dto/create-work-item.dto";
import { CreateWorkItemCommentDto } from "./dto/create-work-item-comment.dto";
import { UpdateWorkItemDto } from "./dto/update-work-item.dto";
import { UpdateWorkItemCommentDto } from "./dto/update-work-item-comment.dto";

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly collaboration: CollaborationService,
    private readonly media: MediaService
  ) {}

  async findByProject(projectId: string, user: AuthenticatedUser) {
    const canViewProjectBoard = await this.canUseProjectRole(user, projectId, ["VIEWER"]);
    if (!canViewProjectBoard) {
      await this.permissions.assertProjectVisible(user, projectId);
    }

    return this.prisma.workItem.findMany({
      where: canViewProjectBoard
        ? { projectId }
        : {
            projectId,
            document: this.permissions.documentVisibilityWhere(user, projectId, ["VIEWER"])
          },
      include: this.includeRelations(),
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }]
    });
  }

  async create(dto: CreateWorkItemDto, user: AuthenticatedUser) {
    if (dto.documentId) {
      await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);
    } else {
      await this.permissions.assertProjectRole(user, dto.projectId, ["REVIEWER", "EDITOR", "MANAGER"]);
    }
    await this.assertLinkedEntitiesBelongToProject(dto.projectId, dto.documentId, dto.sourceCommentId);

    const item = await this.prisma.workItem.create({
      data: {
        projectId: dto.projectId,
        documentId: dto.documentId || null,
        sourceCommentId: dto.sourceCommentId || null,
        type: dto.type ?? WorkItemType.TASK,
        status: dto.status ?? WorkItemStatus.BACKLOG,
        priority: dto.priority ?? WorkItemPriority.MEDIUM,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        attachments: this.normalizeAttachments(dto.attachments),
        assigneeId: dto.assigneeId || null,
        assigneeName: dto.assigneeName?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: user.id,
        createdByName: user.name || user.email,
        createdByEmail: user.email
      },
      include: this.includeRelations()
    });

    await this.collaboration.log(user, "WORK_ITEM_CREATED", "Project", dto.projectId, {
      workItemId: item.id,
      type: item.type,
      status: item.status,
      documentId: item.documentId,
      sourceCommentId: item.sourceCommentId
    });

    return item;
  }

  async createFromComment(commentId: string, dto: Omit<CreateWorkItemDto, "projectId" | "documentId" | "sourceCommentId">, user: AuthenticatedUser) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { document: { select: { id: true, projectId: true, title: true } } }
    });
    if (!comment) throw new NotFoundException("Comment not found");

    await this.permissions.assertDocumentRole(user, comment.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);

    return this.create(
      {
        ...dto,
        projectId: comment.document.projectId,
        documentId: comment.documentId,
        sourceCommentId: comment.id,
        title: dto.title?.trim() || comment.content.slice(0, 160),
        description: dto.description?.trim() || [comment.selectedText, comment.content].filter(Boolean).join("\n\n")
      },
      user
    );
  }

  async update(id: string, dto: UpdateWorkItemDto, user: AuthenticatedUser) {
    const existing = await this.prisma.workItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Work item not found");

    await this.assertWorkItemRole(existing, user, ["REVIEWER", "EDITOR", "MANAGER"]);
    const onlyStatusChange = this.isOnlyStatusChange(dto);
    if (!onlyStatusChange) {
      this.assertOwnedByCurrentUser(existing, user, "Bạn chỉ có thể sửa ticket do chính mình tạo");
    }
    await this.assertLinkedEntitiesBelongToProject(
      existing.projectId,
      dto.documentId === undefined ? existing.documentId ?? undefined : dto.documentId ?? undefined,
      dto.sourceCommentId === undefined ? existing.sourceCommentId ?? undefined : dto.sourceCommentId ?? undefined
    );
    if (dto.documentId !== undefined && dto.documentId) {
      await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);
    }

    const data: Prisma.WorkItemUpdateInput = {};
    if (dto.documentId !== undefined) data.document = dto.documentId ? { connect: { id: dto.documentId } } : { disconnect: true };
    if (dto.sourceCommentId !== undefined) data.sourceComment = dto.sourceCommentId ? { connect: { id: dto.sourceCommentId } } : { disconnect: true };
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.attachments !== undefined) data.attachments = this.normalizeAttachments(dto.attachments);
    if (dto.assigneeId !== undefined) data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
    if (dto.assigneeName !== undefined) data.assigneeName = dto.assigneeName?.trim() || null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const item = await this.prisma.workItem.update({
      where: { id },
      data,
      include: this.includeRelations()
    });

    await this.collaboration.log(user, "WORK_ITEM_UPDATED", "Project", existing.projectId, {
      workItemId: id,
      status: item.status,
      priority: item.priority
    });

    return item;
  }

  async uploadAttachment(id: string, file: Express.Multer.File | undefined, user: AuthenticatedUser) {
    const item = await this.prisma.workItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException("Work item not found");
    await this.assertWorkItemRole(item, user, ["REVIEWER", "EDITOR", "MANAGER"]);
    this.assertOwnedByCurrentUser(item, user, "Bạn chỉ có thể upload file vào ticket do chính mình tạo");

    const media = await this.media.upload(file, { projectId: item.projectId, documentId: item.documentId ?? undefined }, user);
    const nextAttachments = [
      ...this.readAttachments(item.attachments),
      { url: media.url, name: media.cloudinaryPublicId.split("/").pop() ?? "Attachment", mimeType: media.mimeType ?? undefined }
    ];

    const updated = await this.prisma.workItem.update({
      where: { id },
      data: { attachments: nextAttachments },
      include: this.includeRelations()
    });

    await this.collaboration.log(user, "WORK_ITEM_ATTACHMENT_ADDED", "Project", item.projectId, {
      workItemId: id,
      documentId: item.documentId,
      attachmentUrl: media.url,
      mimeType: media.mimeType
    });

    return updated;
  }

  async activity(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.workItem.findUnique({ where: { id }, select: { id: true, projectId: true, documentId: true } });
    if (!item) throw new NotFoundException("Work item not found");
    await this.assertWorkItemRole(item, user, ["VIEWER"]);

    return this.prisma.auditLog.findMany({
      where: {
        metadata: {
          path: ["workItemId"],
          equals: id
        }
      },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 60
    });
  }

  async comments(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.workItem.findUnique({ where: { id }, select: { projectId: true, documentId: true } });
    if (!item) throw new NotFoundException("Work item not found");
    await this.assertWorkItemRole(item, user, ["VIEWER"]);

    return this.prisma.workItemComment.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: "asc" },
      include: { createdBy: { select: { id: true, name: true, email: true } } }
    });
  }

  async createComment(id: string, dto: CreateWorkItemCommentDto, user: AuthenticatedUser) {
    const item = await this.prisma.workItem.findUnique({ where: { id }, select: { projectId: true, documentId: true } });
    if (!item) throw new NotFoundException("Work item not found");
    await this.assertWorkItemRole(item, user, ["REVIEWER", "EDITOR", "MANAGER"]);

    if (dto.parentId) {
      const parent = await this.prisma.workItemComment.findUnique({ where: { id: dto.parentId }, select: { workItemId: true } });
      if (!parent || parent.workItemId !== id) throw new BadRequestException("Reply parent does not belong to work item");
    }

    const comment = await this.prisma.workItemComment.create({
      data: {
        workItemId: id,
        parentId: dto.parentId || null,
        content: dto.content.trim(),
        createdById: user.id,
        createdByName: user.name || user.email,
        createdByEmail: user.email
      },
      include: { createdBy: { select: { id: true, name: true, email: true } } }
    });

    await this.collaboration.log(user, dto.parentId ? "WORK_ITEM_REPLY_CREATED" : "WORK_ITEM_COMMENT_CREATED", "Project", item.projectId, {
      workItemId: id,
      commentId: comment.id,
      parentId: comment.parentId
    });

    return comment;
  }

  async updateComment(workItemId: string, commentId: string, dto: UpdateWorkItemCommentDto, user: AuthenticatedUser) {
    const comment = await this.assertCanChangeWorkItemComment(workItemId, commentId, user);

    const updated = await this.prisma.workItemComment.update({
      where: { id: commentId },
      data: { content: dto.content.trim() },
      include: { createdBy: { select: { id: true, name: true, email: true } } }
    });

    await this.collaboration.log(user, "WORK_ITEM_COMMENT_UPDATED", "Project", comment.workItem.projectId, {
      workItemId,
      commentId
    });

    return updated;
  }

  async removeComment(workItemId: string, commentId: string, user: AuthenticatedUser) {
    const comment = await this.assertCanChangeWorkItemComment(workItemId, commentId, user);
    await this.assertNoOtherUserWorkItemReplies(commentId, user);

    await this.prisma.workItemComment.delete({ where: { id: commentId } });
    await this.collaboration.log(user, "WORK_ITEM_COMMENT_DELETED", "Project", comment.workItem.projectId, {
      workItemId,
      commentId
    });
    return { ok: true };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.workItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Work item not found");

    await this.assertWorkItemRole(existing, user, ["REVIEWER", "EDITOR", "MANAGER"]);
    this.assertOwnedByCurrentUser(existing, user, "Bạn chỉ có thể xóa ticket do chính mình tạo");
    await this.prisma.workItem.delete({ where: { id } });
    await this.collaboration.log(user, "WORK_ITEM_DELETED", "Project", existing.projectId, { workItemId: id });
    return { ok: true };
  }

  private includeRelations() {
    return {
      document: { select: { id: true, title: true, type: true, currentVersion: true } },
      sourceComment: { select: { id: true, blockId: true, selectedText: true, content: true, status: true } },
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } }
    } satisfies Prisma.WorkItemInclude;
  }

  private async assertLinkedEntitiesBelongToProject(projectId: string, documentId?: string | null, sourceCommentId?: string | null) {
    if (documentId) {
      const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { projectId: true } });
      if (!document) throw new NotFoundException("Document not found");
      if (document.projectId !== projectId) throw new BadRequestException("Document does not belong to project");
    }

    if (sourceCommentId) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: sourceCommentId },
        select: { document: { select: { projectId: true } } }
      });
      if (!comment) throw new NotFoundException("Comment not found");
      if (comment.document.projectId !== projectId) throw new BadRequestException("Comment does not belong to project");
    }
  }

  private async assertCanChangeWorkItemComment(workItemId: string, commentId: string, user: AuthenticatedUser) {
    const comment = await this.prisma.workItemComment.findUnique({
      where: { id: commentId },
      include: { workItem: { select: { projectId: true } } }
    });
    if (!comment || comment.workItemId !== workItemId) throw new NotFoundException("Work item comment not found");

    await this.assertWorkItemRole(comment.workItem, user, ["REVIEWER", "EDITOR", "MANAGER"]);
    const isOwner = comment.createdById === user.id || comment.createdByEmail === user.email;
    if (!isOwner) {
      throw new BadRequestException("Bạn chỉ có thể sửa hoặc xóa comment của chính mình");
    }
    return comment;
  }

  private async assertNoOtherUserWorkItemReplies(parentId: string, user: AuthenticatedUser) {
    const otherUserReplies = await this.prisma.workItemComment.count({
      where: {
        parentId,
        NOT: {
          OR: [
            { createdById: user.id },
            { createdByEmail: user.email }
          ]
        }
      }
    });
    if (otherUserReplies > 0) {
      throw new BadRequestException("Không thể xóa comment này vì đang có reply của người khác");
    }
  }

  private assertOwnedByCurrentUser(
    entity: { createdById?: string | null; createdByEmail?: string | null },
    user: AuthenticatedUser,
    message: string
  ) {
    const isOwner = entity.createdById === user.id || entity.createdByEmail === user.email;
    if (!isOwner) throw new BadRequestException(message);
  }

  private normalizeAttachments(attachments?: Array<{ url: string; name?: string; mimeType?: string }> | null) {
    if (!attachments?.length) return Prisma.JsonNull;
    return attachments
      .map((attachment) => ({
        url: attachment.url.trim(),
        name: attachment.name?.trim() || attachment.url.trim().split("/").pop() || "Attachment",
        mimeType: attachment.mimeType?.trim() || null
      }))
      .filter((attachment) => attachment.url);
  }

  private async assertWorkItemRole(
    item: { projectId: string; documentId?: string | null },
    user: AuthenticatedUser,
    allowedRoles: ProjectRole[]
  ) {
    if (item.documentId) {
      return this.permissions.assertDocumentRole(user, item.documentId, allowedRoles);
    }
    return this.permissions.assertProjectRole(user, item.projectId, allowedRoles);
  }

  private isOnlyStatusChange(dto: UpdateWorkItemDto) {
    return dto.status !== undefined &&
      dto.documentId === undefined &&
      dto.sourceCommentId === undefined &&
      dto.type === undefined &&
      dto.priority === undefined &&
      dto.title === undefined &&
      dto.description === undefined &&
      dto.attachments === undefined &&
      dto.assigneeId === undefined &&
      dto.assigneeName === undefined &&
      dto.dueDate === undefined;
  }

  private async canUseProjectRole(
    user: AuthenticatedUser,
    projectId: string,
    allowedRoles: ProjectRole[]
  ) {
    try {
      await this.permissions.assertProjectRole(user, projectId, allowedRoles);
      return true;
    } catch {
      return false;
    }
  }

  private readAttachments(value: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(value)) return [];
    const attachments: Array<{ url: string; name?: string; mimeType?: string } | null> = value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        if (typeof record.url !== "string") return null;
        return {
          url: record.url,
          name: typeof record.name === "string" ? record.name : undefined,
          mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined
        };
      })
    return attachments.filter((item): item is { url: string; name?: string; mimeType?: string } => Boolean(item));
  }
}
