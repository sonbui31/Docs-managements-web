import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentStatus, Prisma, ProjectRole, WorkItemPriority, WorkItemStatus, WorkItemType } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { CollaborationService } from "../collaboration/collaboration.service";
import { MediaService } from "../media/media.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { WorkboardColumnsService } from "../workboard-columns/workboard-columns.service";
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
    private readonly media: MediaService,
    private readonly workboardColumns: WorkboardColumnsService,
    private readonly notifications: NotificationsService
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

  async findOne(id: string, user: AuthenticatedUser) {
    const item = await this.prisma.workItem.findUnique({
      where: { id },
      select: { id: true, projectId: true, documentId: true }
    });
    if (!item) throw new NotFoundException("Work item not found");
    await this.assertWorkItemRole(item, user, ["VIEWER"]);

    return this.hydrateWorkItem(id);
  }

  async create(dto: CreateWorkItemDto, user: AuthenticatedUser) {
    if (dto.documentId) {
      await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);
    } else {
      await this.permissions.assertProjectRole(user, dto.projectId, ["REVIEWER", "EDITOR", "MANAGER"]);
    }
    await this.assertLinkedEntitiesBelongToProject(dto.projectId, dto.documentId, dto.sourceCommentId);
    await this.assertDependenciesBelongToProject(dto.projectId, dto.dependencyIds);

    const assigneeUsers = await this.resolveAssignableUsers(dto.projectId, this.workItemAssigneeIds(dto), user, dto.documentId);
    const labels = await this.ensureLabels(dto.projectId, dto.labelNames ?? []);
    const column = await this.workboardColumns.resolveColumnForWorkItem(dto.projectId, dto.columnId, dto.status);

    const item = await this.prisma.workItem.create({
      data: {
        projectId: dto.projectId,
        documentId: dto.documentId || null,
        sourceCommentId: dto.sourceCommentId || null,
        type: dto.type ?? WorkItemType.TASK,
        status: this.workboardColumns.statusForColumn(column),
        columnId: column.id,
        priority: dto.priority ?? WorkItemPriority.MEDIUM,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        attachments: this.normalizeAttachments(dto.attachments),
        assigneeId: assigneeUsers[0]?.id ?? dto.assigneeId ?? null,
        assigneeName: assigneeUsers.length ? assigneeUsers.map((assignee) => assignee.name).join(", ") : dto.assigneeName?.trim() || null,
        assignees: assigneeUsers.length
          ? { create: assigneeUsers.map((assignee) => ({ user: { connect: { id: assignee.id } }, assignedBy: user.id })) }
          : undefined,
        checklistItems: dto.checklistItems?.length
          ? {
              create: this.normalizeChecklistItems(dto.checklistItems).map((item, index) => ({
                title: item.title,
                done: item.done,
                position: index
              }))
            }
          : undefined,
        labels: labels.length
          ? { create: labels.map((label) => ({ label: { connect: { id: label.id } } })) }
          : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        createdById: user.id,
        createdByName: user.name || user.email,
        createdByEmail: user.email
      },
      include: this.includeRelations()
    });

    if (dto.dependencyIds?.length) {
      await this.syncDependencies(item.id, item.projectId, dto.dependencyIds, user);
    }

    await this.collaboration.log(user, "WORK_ITEM_CREATED", "Project", dto.projectId, {
      workItemId: item.id,
      type: item.type,
      status: item.status,
      documentId: item.documentId,
      sourceCommentId: item.sourceCommentId,
      assigneeIds: assigneeUsers.map((assignee) => assignee.id),
      labels: labels.map((label) => label.name)
    });
    await this.notifyUsers(
      assigneeUsers.map((assignee) => assignee.id),
      user,
      "Bạn được gán ticket mới",
      `${user.name || user.email} đã gán bạn vào ticket: ${item.title}`,
      item.id
    );

    return this.hydrateWorkItem(item.id);
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
    const existing = await this.prisma.workItem.findUnique({
      where: { id },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        checklistItems: { orderBy: { position: "asc" } },
        labels: { include: { label: true } },
        blockingLinks: true,
        column: true
      }
    });
    if (!existing) throw new NotFoundException("Work item not found");

    await this.assertWorkItemRole(existing, user, ["REVIEWER", "EDITOR", "MANAGER"]);
    const onlyStatusChange = this.isOnlyStatusChange(dto);
    if (!onlyStatusChange) {
      this.assertOwnedByCurrentUser(existing, user, "Bạn chỉ có thể sửa ticket do chính mình tạo");
    }
    const nextDocumentId = dto.documentId === undefined ? existing.documentId ?? undefined : dto.documentId ?? undefined;
    const nextSourceCommentId = dto.sourceCommentId === undefined ? existing.sourceCommentId ?? undefined : dto.sourceCommentId ?? undefined;

    await this.assertLinkedEntitiesBelongToProject(
      existing.projectId,
      nextDocumentId,
      nextSourceCommentId
    );
    await this.assertDependenciesBelongToProject(existing.projectId, dto.dependencyIds);
    if (dto.documentId !== undefined && dto.documentId) {
      await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);
    }
    const assigneeUsers = dto.assigneeIds !== undefined || dto.assigneeId !== undefined
      ? await this.resolveAssignableUsers(existing.projectId, this.workItemAssigneeIds(dto), user, nextDocumentId)
      : null;
    const labels = dto.labelNames !== undefined
      ? await this.ensureLabels(existing.projectId, dto.labelNames ?? [])
      : null;
    const changes = this.workItemChanges(existing, dto, assigneeUsers, labels);
    const targetColumn = dto.columnId !== undefined || dto.status !== undefined
      ? await this.workboardColumns.resolveColumnForWorkItem(existing.projectId, dto.columnId, dto.status ?? existing.status)
      : null;

    const data: Prisma.WorkItemUpdateInput = {};
    if (dto.documentId !== undefined) data.document = dto.documentId ? { connect: { id: dto.documentId } } : { disconnect: true };
    if (dto.sourceCommentId !== undefined) data.sourceComment = dto.sourceCommentId ? { connect: { id: dto.sourceCommentId } } : { disconnect: true };
    if (dto.type !== undefined) data.type = dto.type;
    if (targetColumn) {
      data.column = { connect: { id: targetColumn.id } };
      data.status = this.workboardColumns.statusForColumn(targetColumn);
    } else if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.attachments !== undefined) data.attachments = this.normalizeAttachments(dto.attachments);
    if (assigneeUsers) {
      data.assignee = assigneeUsers[0] ? { connect: { id: assigneeUsers[0].id } } : { disconnect: true };
      data.assigneeName = assigneeUsers.length ? assigneeUsers.map((assignee) => assignee.name).join(", ") : dto.assigneeName?.trim() || null;
    } else if (dto.assigneeName !== undefined) {
      data.assigneeName = dto.assigneeName?.trim() || null;
    }
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    let item = await this.prisma.workItem.update({
      where: { id },
      data,
      include: this.includeRelations()
    });

    if (assigneeUsers) {
      await this.syncAssignees(id, assigneeUsers.map((assignee) => assignee.id), user);
    }
    if (dto.checklistItems !== undefined) {
      await this.syncChecklist(id, dto.checklistItems ?? []);
    }
    if (labels) {
      await this.syncLabels(id, labels.map((label) => label.id));
    }
    if (dto.dependencyIds !== undefined) {
      await this.syncDependencies(id, existing.projectId, dto.dependencyIds ?? [], user);
    }
    item = await this.hydrateWorkItem(id);

    await this.collaboration.log(user, "WORK_ITEM_UPDATED", "Project", existing.projectId, {
      workItemId: id,
      status: item.status,
      priority: item.priority,
      changes: changes as Prisma.InputJsonValue
    });
    if (assigneeUsers) {
      const previousIds = new Set(existing.assignees.map((assignee) => assignee.userId));
      const newIds = assigneeUsers.map((assignee) => assignee.id).filter((assigneeId) => !previousIds.has(assigneeId));
      await this.notifyUsers(
        newIds,
        user,
        "Bạn được gán vào ticket",
        `${user.name || user.email} đã gán bạn vào ticket: ${item.title}`,
        item.id
      );
    }

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

    let parentComment: { workItemId: string; createdById: string | null; createdByEmail: string | null } | null = null;
    if (dto.parentId) {
      parentComment = await this.prisma.workItemComment.findUnique({
        where: { id: dto.parentId },
        select: { workItemId: true, createdById: true, createdByEmail: true }
      });
      if (!parentComment || parentComment.workItemId !== id) throw new BadRequestException("Reply parent does not belong to work item");
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
    const mentionedUsers = await this.notifications.mentionedUsers(dto.content);
    const mentionedIds = mentionedUsers.map((mentionedUser) => mentionedUser.id);
    const emailUrl = this.notifications.entityUrl({ projectId: item.projectId, documentId: item.documentId, workItemId: id });

    if (parentComment) {
      const replyRecipientIds = await this.workItemCommentAuthorIds(parentComment);
      await this.notifications.createForUsers({
        userIds: replyRecipientIds.filter((userId) => !mentionedIds.includes(userId)),
        actor: user,
        title: "Có phản hồi trong ticket",
        message: `${user.name || user.email} đã trả lời comment của bạn trong ticket.`,
        entityType: "WorkItem",
        entityId: id,
        emailUrl
      });
    }

    await this.notifications.createForUsers({
      userIds: mentionedIds,
      actor: user,
      title: "Bạn được nhắc đến trong ticket",
      message: `${user.name || user.email} đã nhắc đến bạn trong ticket.`,
      entityType: "WorkItem",
      entityId: id,
      emailUrl
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
      column: true,
      sourceComment: { select: { id: true, blockId: true, selectedText: true, content: true, status: true } },
      assignee: { select: { id: true, name: true, email: true } },
      assignees: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" }
      },
      checklistItems: { orderBy: { position: "asc" } },
      labels: {
        include: { label: true },
        orderBy: { createdAt: "asc" }
      },
      blockingLinks: {
        include: { blockerItem: { select: { id: true, title: true, status: true } } },
        orderBy: { createdAt: "asc" }
      },
      createdBy: { select: { id: true, name: true, email: true } }
    } satisfies Prisma.WorkItemInclude;
  }

  private hydrateWorkItem(id: string) {
    return this.prisma.workItem.findUniqueOrThrow({
      where: { id },
      include: this.includeRelations()
    });
  }

  private workItemAssigneeIds(dto: { assigneeId?: string | null; assigneeIds?: string[] | null }) {
    return this.uniqueIds([...(dto.assigneeIds ?? []), ...(dto.assigneeId ? [dto.assigneeId] : [])]);
  }

  private uniqueIds(ids: Array<string | null | undefined>) {
    return Array.from(new Set(ids.map((id) => id?.trim()).filter((id): id is string => Boolean(id))));
  }

  private async resolveAssignableUsers(projectId: string, userIds: string[], actor: AuthenticatedUser, documentId?: string | null) {
    const ids = this.uniqueIds(userIds);
    if (!ids.length) return [];

    const members = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: ids }, user: { deletedAt: null, status: "ACTIVE" } },
      include: { user: { select: { id: true, name: true, email: true } } }
    });
    const usersById = new Map(members.map((member) => [member.userId, member.user]));

    if (documentId) {
      const documentPermissionUsers = await this.prisma.documentPermission.findMany({
        where: {
          projectId,
          documentId,
          userId: { in: ids.filter((id) => !usersById.has(id)) },
          user: { deletedAt: null, status: "ACTIVE" }
        },
        include: { user: { select: { id: true, name: true, email: true } } }
      });
      documentPermissionUsers.forEach((permission) => usersById.set(permission.userId, permission.user));
    }

    const missingIds = ids.filter((id) => !usersById.has(id));
    if (missingIds.length === 1 && missingIds[0] === actor.id) {
      await this.permissions.assertProjectRole(actor, projectId, ["VIEWER"]);
      const actorUser = await this.prisma.user.findFirst({
        where: { id: actor.id, deletedAt: null, status: "ACTIVE" },
        select: { id: true, name: true, email: true }
      });
      if (actorUser) usersById.set(actorUser.id, actorUser);
    }

    if (ids.some((id) => !usersById.has(id))) {
      throw new BadRequestException("Người phụ trách phải là thành viên dự án hoặc người có quyền trên tài liệu liên quan");
    }
    return ids.map((id) => usersById.get(id)).filter((user): user is { id: string; name: string; email: string } => Boolean(user));
  }

  private normalizeChecklistItems(items?: Array<{ title: string; done?: boolean }> | null) {
    return (items ?? [])
      .map((item) => ({ title: item.title.trim(), done: Boolean(item.done) }))
      .filter((item) => item.title)
      .slice(0, 80);
  }

  private normalizeLabelNames(labelNames?: string[] | null) {
    return Array.from(
      new Set(
        (labelNames ?? [])
          .map((label) => label.trim().replace(/\s+/g, " "))
          .filter(Boolean)
          .slice(0, 20)
      )
    );
  }

  private async ensureLabels(projectId: string, labelNames: string[]) {
    const names = this.normalizeLabelNames(labelNames);
    if (!names.length) return [];
    return Promise.all(
      names.map((name) =>
        this.prisma.workItemLabel.upsert({
          where: { projectId_name: { projectId, name } },
          create: { projectId, name },
          update: {}
        })
      )
    );
  }

  private async syncAssignees(workItemId: string, assigneeIds: string[], user: AuthenticatedUser) {
    await this.prisma.workItemAssignee.deleteMany({ where: { workItemId } });
    if (!assigneeIds.length) return;
    await this.prisma.workItemAssignee.createMany({
      data: assigneeIds.map((userId) => ({ workItemId, userId, assignedBy: user.id })),
      skipDuplicates: true
    });
  }

  private async syncChecklist(workItemId: string, items: Array<{ title: string; done?: boolean }>) {
    const normalized = this.normalizeChecklistItems(items);
    await this.prisma.workItemChecklistItem.deleteMany({ where: { workItemId } });
    if (!normalized.length) return;
    await this.prisma.workItemChecklistItem.createMany({
      data: normalized.map((item, index) => ({
        workItemId,
        title: item.title,
        done: item.done,
        position: index
      }))
    });
  }

  private async syncLabels(workItemId: string, labelIds: string[]) {
    await this.prisma.workItemLabelLink.deleteMany({ where: { workItemId } });
    if (!labelIds.length) return;
    await this.prisma.workItemLabelLink.createMany({
      data: labelIds.map((labelId) => ({ workItemId, labelId })),
      skipDuplicates: true
    });
  }

  private async syncDependencies(workItemId: string, projectId: string, dependencyIds: string[], user: AuthenticatedUser) {
    const ids = this.uniqueIds(dependencyIds).filter((id) => id !== workItemId);
    await this.assertDependenciesBelongToProject(projectId, ids);
    await this.prisma.workItemDependency.deleteMany({ where: { blockedItemId: workItemId } });
    if (!ids.length) return;
    await this.prisma.workItemDependency.createMany({
      data: ids.map((blockerItemId) => ({ blockedItemId: workItemId, blockerItemId, createdById: user.id })),
      skipDuplicates: true
    });
  }

  private async assertDependenciesBelongToProject(projectId: string, dependencyIds?: string[] | null) {
    const ids = this.uniqueIds(dependencyIds ?? []);
    if (!ids.length) return;
    const count = await this.prisma.workItem.count({ where: { id: { in: ids }, projectId } });
    if (count !== ids.length) {
      throw new BadRequestException("Ticket phụ thuộc phải thuộc cùng dự án");
    }
  }

  private async notifyUsers(userIds: string[], actor: AuthenticatedUser, title: string, message: string, workItemId: string) {
    const recipients = this.uniqueIds(userIds).filter((userId) => userId !== actor.id);
    if (!recipients.length) return;
    const item = await this.prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { projectId: true, documentId: true }
    });
    await this.notifications.createForUsers({
      userIds: recipients,
      actor,
      title,
      message,
      entityType: "WorkItem",
      entityId: workItemId,
      emailUrl: this.notifications.entityUrl({ projectId: item?.projectId, documentId: item?.documentId, workItemId })
    });
  }

  private workItemChanges(
    existing: {
      title: string;
      status: WorkItemStatus;
      priority: WorkItemPriority;
      dueDate?: Date | null;
      assigneeName?: string | null;
      assignees: Array<{ user: { name: string } }>;
      checklistItems: Array<{ title: string; done: boolean }>;
      labels: Array<{ label: { name: string } }>;
      blockingLinks: Array<{ blockerItemId: string }>;
      column?: { id: string; name: string } | null;
    },
    dto: UpdateWorkItemDto,
    assignees: Array<{ id: string; name: string; email: string }> | null,
    labels: Array<{ id: string; name: string }> | null
  ) {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (dto.title !== undefined && dto.title.trim() !== existing.title) changes.title = { from: existing.title, to: dto.title.trim() };
    if (dto.status !== undefined && dto.status !== existing.status) changes.status = { from: existing.status, to: dto.status };
    if (dto.columnId !== undefined && dto.columnId !== existing.column?.id) {
      changes.column = { from: existing.column?.name ?? existing.status, to: dto.columnId };
    }
    if (dto.priority !== undefined && dto.priority !== existing.priority) changes.priority = { from: existing.priority, to: dto.priority };
    if (dto.dueDate !== undefined) {
      const from = existing.dueDate ? existing.dueDate.toISOString().slice(0, 10) : null;
      const to = dto.dueDate ? new Date(dto.dueDate).toISOString().slice(0, 10) : null;
      if (from !== to) changes.dueDate = { from, to };
    }
    if (assignees) {
      const from = existing.assignees.length ? existing.assignees.map((assignee) => assignee.user.name) : existing.assigneeName ? [existing.assigneeName] : [];
      const to = assignees.map((assignee) => assignee.name);
      if (from.join("|") !== to.join("|")) changes.assignees = { from, to };
    }
    if (dto.checklistItems !== undefined) {
      changes.checklist = {
        from: existing.checklistItems.map((item) => ({ title: item.title, done: item.done })),
        to: this.normalizeChecklistItems(dto.checklistItems ?? [])
      };
    }
    if (labels) {
      const from = existing.labels.map((item) => item.label.name);
      const to = labels.map((label) => label.name);
      if (from.join("|") !== to.join("|")) changes.labels = { from, to };
    }
    if (dto.dependencyIds !== undefined) {
      changes.dependencies = {
        from: existing.blockingLinks.map((link) => link.blockerItemId),
        to: this.uniqueIds(dto.dependencyIds ?? [])
      };
    }
    return changes;
  }

  private async assertLinkedEntitiesBelongToProject(projectId: string, documentId?: string | null, sourceCommentId?: string | null) {
    if (documentId) {
      const document = await this.prisma.document.findUnique({ where: { id: documentId }, select: { projectId: true, status: true } });
      if (!document) throw new NotFoundException("Document not found");
      if (document.projectId !== projectId) throw new BadRequestException("Document does not belong to project");
      if (!this.isDeployedDocumentStatus(document.status)) throw new BadRequestException("Chỉ có thể gắn ticket với tài liệu đã Triển khai");
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

  private isDeployedDocumentStatus(status: DocumentStatus) {
    const draftStatuses: DocumentStatus[] = [DocumentStatus.DRAFT, DocumentStatus.IN_REVIEW, DocumentStatus.CHANGES_REQUESTED];
    return !draftStatuses.includes(status);
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

  private async workItemCommentAuthorIds(comment: { createdById?: string | null; createdByEmail?: string | null }) {
    if (comment.createdById) return this.uniqueIds([comment.createdById]);
    if (!comment.createdByEmail?.trim()) return [];

    const author = await this.prisma.user.findFirst({
      where: { email: comment.createdByEmail.trim().toLowerCase(), deletedAt: null, status: "ACTIVE" },
      select: { id: true }
    });

    return this.uniqueIds([author?.id]);
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
    return (dto.status !== undefined || dto.columnId !== undefined) &&
      dto.documentId === undefined &&
      dto.sourceCommentId === undefined &&
      dto.type === undefined &&
      dto.priority === undefined &&
      dto.title === undefined &&
      dto.description === undefined &&
      dto.attachments === undefined &&
      dto.assigneeId === undefined &&
      dto.assigneeIds === undefined &&
      dto.assigneeName === undefined &&
      dto.dueDate === undefined &&
      dto.checklistItems === undefined &&
      dto.labelNames === undefined &&
      dto.dependencyIds === undefined;
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
