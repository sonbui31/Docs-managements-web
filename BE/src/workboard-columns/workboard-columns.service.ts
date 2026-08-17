import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, WorkItemStatus, WorkboardColumnType } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWorkboardColumnDto } from "./dto/create-workboard-column.dto";
import { ReorderWorkboardColumnsDto } from "./dto/reorder-workboard-columns.dto";
import { UpdateWorkboardColumnDto } from "./dto/update-workboard-column.dto";

const defaultColumns = [
  { key: "BACKLOG", name: "Backlog", color: "#64748b", type: "OPEN", position: 0, isDefault: true, isDone: false },
  { key: "TODO", name: "To Do", color: "#3b82f6", type: "OPEN", position: 1, isDefault: false, isDone: false },
  { key: "IN_PROGRESS", name: "In Progress", color: "#f59e0b", type: "IN_PROGRESS", position: 2, isDefault: false, isDone: false },
  { key: "REVIEW", name: "Review / QA", color: "#8b5cf6", type: "REVIEW", position: 3, isDefault: false, isDone: false },
  { key: "BLOCKED", name: "Blocked", color: "#ef4444", type: "BLOCKED", position: 4, isDefault: false, isDone: false },
  { key: "DONE", name: "Done", color: "#10b981", type: "DONE", position: 5, isDefault: false, isDone: true }
] satisfies Array<{
  key: WorkItemStatus;
  name: string;
  color: string;
  type: WorkboardColumnType;
  position: number;
  isDefault: boolean;
  isDone: boolean;
}>;

@Injectable()
export class WorkboardColumnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);
    await this.ensureDefaultColumns(projectId);
    return this.list(projectId);
  }

  async create(projectId: string, dto: CreateWorkboardColumnDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["EDITOR", "MANAGER"]);
    await this.ensureDefaultColumns(projectId);
    const position = dto.position ?? await this.nextPosition(projectId);
    const key = await this.uniqueKey(projectId, dto.key ?? dto.name);
    if (dto.isDefault) await this.clearDefault(projectId);

    const column = await this.prisma.workboardColumn.create({
      data: {
        projectId,
        key,
        name: dto.name.trim(),
        color: dto.color || "#6366f1",
        type: dto.type ?? WorkboardColumnType.OPEN,
        position,
        isDefault: Boolean(dto.isDefault),
        isDone: Boolean(dto.isDone)
      }
    });
    await this.normalizePosition(projectId);
    return column;
  }

  async update(id: string, dto: UpdateWorkboardColumnDto, user: AuthenticatedUser) {
    const existing = await this.findColumnOrThrow(id);
    await this.permissions.assertProjectRole(user, existing.projectId, ["EDITOR", "MANAGER"]);
    if (dto.isDefault) await this.clearDefault(existing.projectId);

    const updated = await this.prisma.workboardColumn.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color || "#6366f1" } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isDone !== undefined ? { isDone: dto.isDone } : {})
      }
    });
    await this.ensureOneDefault(existing.projectId);
    await this.normalizePosition(existing.projectId);
    return updated;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const existing = await this.findColumnOrThrow(id);
    await this.permissions.assertProjectRole(user, existing.projectId, ["EDITOR", "MANAGER"]);
    const columnCount = await this.prisma.workboardColumn.count({ where: { projectId: existing.projectId } });
    if (columnCount <= 1) throw new BadRequestException("Không thể xóa cột cuối cùng của board");
    const workItemCount = await this.prisma.workItem.count({ where: { columnId: id } });
    if (workItemCount > 0) throw new BadRequestException("Không thể xóa cột đang có ticket");
    await this.prisma.workboardColumn.delete({ where: { id } });
    await this.ensureOneDefault(existing.projectId);
    await this.normalizePosition(existing.projectId);
    return { ok: true };
  }

  async reorder(projectId: string, dto: ReorderWorkboardColumnsDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["EDITOR", "MANAGER"]);
    const columns = await this.prisma.workboardColumn.findMany({ where: { projectId }, select: { id: true } });
    const validIds = new Set(columns.map((column) => column.id));
    if (dto.columnIds.some((id) => !validIds.has(id))) {
      throw new BadRequestException("Danh sách cột reorder không hợp lệ");
    }
    await this.prisma.$transaction(
      dto.columnIds.map((id, index) =>
        this.prisma.workboardColumn.update({ where: { id }, data: { position: index } })
      )
    );
    await this.normalizePosition(projectId);
    return this.list(projectId);
  }

  async ensureDefaultColumns(projectId: string) {
    const count = await this.prisma.workboardColumn.count({ where: { projectId } });
    if (count > 0) return;
    await this.prisma.workboardColumn.createMany({
      data: defaultColumns.map((column) => ({ ...column, projectId }))
    });
  }

  async resolveColumnForWorkItem(projectId: string, columnId?: string | null, status?: WorkItemStatus | null) {
    await this.ensureDefaultColumns(projectId);
    if (columnId) {
      const column = await this.prisma.workboardColumn.findFirst({ where: { id: columnId, projectId } });
      if (!column) throw new BadRequestException("Cột Workboard không thuộc dự án này");
      return column;
    }
    if (status) {
      const statusColumn = await this.prisma.workboardColumn.findFirst({
        where: { projectId, key: status },
        orderBy: { position: "asc" }
      });
      if (statusColumn) return statusColumn;
    }
    const defaultColumn = await this.prisma.workboardColumn.findFirst({
      where: { projectId, isDefault: true },
      orderBy: { position: "asc" }
    });
    if (defaultColumn) return defaultColumn;
    return this.prisma.workboardColumn.findFirstOrThrow({ where: { projectId }, orderBy: { position: "asc" } });
  }

  statusForColumn(column: { key: string; type: WorkboardColumnType; isDone: boolean }): WorkItemStatus {
    if ((Object.values(WorkItemStatus) as string[]).includes(column.key)) return column.key as WorkItemStatus;
    if (column.isDone || column.type === WorkboardColumnType.DONE || column.type === WorkboardColumnType.ARCHIVED) return WorkItemStatus.DONE;
    if (column.type === WorkboardColumnType.BLOCKED) return WorkItemStatus.BLOCKED;
    if (
      column.type === WorkboardColumnType.REVIEW ||
      column.type === WorkboardColumnType.QA ||
      column.type === WorkboardColumnType.WAITING ||
      column.type === WorkboardColumnType.REWORK ||
      column.type === WorkboardColumnType.APPROVED
    ) return WorkItemStatus.REVIEW;
    if (column.type === WorkboardColumnType.IN_PROGRESS) return WorkItemStatus.IN_PROGRESS;
    if (column.type === WorkboardColumnType.INTAKE) return WorkItemStatus.BACKLOG;
    return WorkItemStatus.TODO;
  }

  private list(projectId: string) {
    return this.prisma.workboardColumn.findMany({ where: { projectId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  }

  private async findColumnOrThrow(id: string) {
    const column = await this.prisma.workboardColumn.findUnique({ where: { id } });
    if (!column) throw new NotFoundException("Workboard column not found");
    return column;
  }

  private async nextPosition(projectId: string) {
    const aggregate = await this.prisma.workboardColumn.aggregate({
      where: { projectId },
      _max: { position: true }
    });
    return (aggregate._max.position ?? -1) + 1;
  }

  private async uniqueKey(projectId: string, value: string) {
    const base = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "COLUMN";
    let candidate = base;
    let index = 2;
    while (await this.prisma.workboardColumn.findUnique({ where: { projectId_key: { projectId, key: candidate } } })) {
      candidate = `${base}_${index++}`;
    }
    return candidate;
  }

  private clearDefault(projectId: string) {
    return this.prisma.workboardColumn.updateMany({ where: { projectId }, data: { isDefault: false } });
  }

  private async ensureOneDefault(projectId: string) {
    const current = await this.prisma.workboardColumn.findFirst({ where: { projectId, isDefault: true } });
    if (current) return;
    const first = await this.prisma.workboardColumn.findFirst({ where: { projectId }, orderBy: { position: "asc" } });
    if (first) await this.prisma.workboardColumn.update({ where: { id: first.id }, data: { isDefault: true } });
  }

  private async normalizePosition(projectId: string) {
    const columns = await this.list(projectId);
    await this.prisma.$transaction(
      columns.map((column, index) =>
        this.prisma.workboardColumn.update({ where: { id: column.id }, data: { position: index } })
      ) as Prisma.PrismaPromise<unknown>[]
    );
  }
}
