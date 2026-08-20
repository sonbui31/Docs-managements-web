import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { GlobalRole, Prisma, ProjectRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { ExternalAuthService } from "../auth/external-auth.service";
import { PermissionsService } from "../permissions/permissions.service";
import { AssignDocumentDto } from "./dto/assign-document.dto";
import { AssignDocumentsBatchDto } from "./dto/assign-documents-batch.dto";
import { AssignProjectDto } from "./dto/assign-project.dto";
import { AssignProjectsBatchDto } from "./dto/assign-projects-batch.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly externalAuth: ExternalAuthService
  ) {}

  async findAll(actor: AuthenticatedUser) {
    this.assertAdminOrManager(actor);
    if (this.externalAuth.isEnabled() && actor.externalAccessToken) {
      try {
        return await this.findExternalCompanyUsers(actor);
      } catch (error) {
        this.logger.warn(
          `External employee sync failed for ${actor.email}; falling back to stored users. ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    return this.findStoredManagedUsers(actor);
  }

  async findShareCandidates(scope: string, targetId: string, actor: AuthenticatedUser) {
    if (scope === "project") {
      await this.permissions.assertProjectRole(actor, targetId, ["MANAGER"]);
    } else if (scope === "document") {
      await this.permissions.assertDocumentRole(actor, targetId, ["MANAGER"]);
    } else {
      throw new BadRequestException("Share scope không hợp lệ");
    }

    return this.findStoredManagedUsers(actor);
  }

  private async findStoredManagedUsers(actor: AuthenticatedUser, ids?: string[]) {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(ids?.length ? { id: { in: ids } } : {}),
        ...this.accessibleUserScope(actor)
      },
      orderBy: { createdAt: "desc" },
      include: this.managedUserInclude()
    });

    return users.map((user) => this.toManagedUser(user));
  }

  private toManagedUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.globalRole,
      externalRole: user.externalRole,
      externalCompanyId: user.externalCompanyId,
      externalDepartmentId: user.externalDepartmentId,
      status: user.status,
      createdAt: user.createdAt,
      sessions: user._count.refreshSessions,
      projects: user.projectMemberships.map((membership: any) => ({
        projectId: membership.projectId,
        role: membership.role,
        roles: this.permissionRoles(membership),
        code: membership.project.code,
        name: membership.project.name
      })),
      documents: user.documentPermissions.map((permission: any) => ({
        documentId: permission.documentId,
        projectId: permission.projectId,
        role: permission.role,
        roles: this.permissionRoles(permission),
        title: permission.document.title,
        type: permission.document.type,
        projectCode: permission.document.project.code
      }))
    };
  }

  private async findExternalCompanyUsers(actor: AuthenticatedUser) {
    const employees = await this.externalAuth.fetchEmployeeUserList(actor.externalAccessToken!, {
      companyId: actor.externalCompanyId,
      departmentId: actor.role === "MANAGER" ? actor.externalDepartmentId : undefined
    });
    await Promise.all(employees.map((employee) => this.syncExternalEmployee(employee, actor)));
    return this.findStoredManagedUsers(actor);
  }

  private async syncExternalEmployee(employee: unknown, actor: AuthenticatedUser) {
    const data = this.mapExternalEmployee(employee, actor);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ externalUserId: data.externalUserId }, { email: data.email }]
      }
    });

    if (existingUser) {
      const updated = await this.prisma.user.update({
        where: { id: existingUser.id },
        data
      });
      return updated.id;
    }

    const created = await this.prisma.user.create({
      data: {
        ...data,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        status: "ACTIVE",
        emailConfirmedAt: new Date()
      }
    });
    return created.id;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) throw new BadRequestException("Email này đã tồn tại");

    return this.toPublicUser(
      await this.prisma.user.create({
        data: {
          email,
          name: dto.name.trim(),
          passwordHash: await bcrypt.hash(dto.password, 12),
          globalRole: dto.role ?? "EMPLOYEE",
          status: "ACTIVE",
          emailConfirmedAt: new Date()
        }
      })
    );
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");
    if (user.globalRole === "ADMIN" && dto.role && dto.role !== "ADMIN") {
      throw new ForbiddenException("Không thể hạ quyền admin hệ thống");
    }

    return this.toPublicUser(
      await this.prisma.user.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          email: dto.email?.trim().toLowerCase(),
          globalRole: dto.role,
          status: dto.status
        }
      })
    );
  }

  async softDelete(id: string, actor: AuthenticatedUser) {
    this.assertAdmin(actor);
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");
    if (user.globalRole === "ADMIN") throw new ForbiddenException("Không thể xóa admin hệ thống");

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "DISABLED" }
    });
    await this.prisma.refreshSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return { ok: true };
  }

  async assignProject(userId: string, dto: AssignProjectDto, actor: AuthenticatedUser) {
    const roles = this.effectiveRoles(dto);
    const role = this.highestRole(roles);
    if (actor.role !== "ADMIN") {
      await this.permissions.assertProjectRole(actor, dto.projectId, ["MANAGER"]);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, ...this.accessibleUserScope(actor) }
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: dto.projectId, userId } },
      create: { projectId: dto.projectId, userId, role, roles, assignedBy: actor.id },
      update: { role, roles, assignedBy: actor.id }
    });
  }

  async assignProjectsBatch(dto: AssignProjectsBatchDto, actor: AuthenticatedUser) {
    const roles = this.effectiveRoles(dto);
    const role = this.highestRole(roles);
    const userIds = this.uniqueIds(dto.userIds);
    const projectIds = this.uniqueIds(dto.projectIds);
    if (!userIds.length || !projectIds.length) {
      throw new BadRequestException("Vui lòng chọn ít nhất một người dùng và một dự án");
    }

    if (actor.role !== "ADMIN") {
      await Promise.all(projectIds.map((projectId) => this.permissions.assertProjectRole(actor, projectId, ["MANAGER"])));
    }

    const [usersCount, projectsCount] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds }, deletedAt: null, ...this.accessibleUserScope(actor) } }),
      this.prisma.project.count({ where: { id: { in: projectIds } } })
    ]);
    if (usersCount !== userIds.length) throw new NotFoundException("Một hoặc nhiều người dùng không tồn tại");
    if (projectsCount !== projectIds.length) throw new NotFoundException("Một hoặc nhiều dự án không tồn tại");

    const operations = projectIds.flatMap((projectId) =>
      userIds.map((userId) =>
        this.prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role, roles, assignedBy: actor.id },
          update: { role, roles, assignedBy: actor.id }
        })
      )
    );

    await this.prisma.$transaction(operations);
    return { ok: true, assigned: operations.length };
  }

  async removeProject(userId: string, projectId: string, actor: AuthenticatedUser) {
    if (actor.role !== "ADMIN") {
      await this.permissions.assertProjectRole(actor, projectId, ["MANAGER"]);
    }
    await this.prisma.projectMember.deleteMany({ where: { userId, projectId } });
    return { ok: true };
  }

  async assignDocument(userId: string, dto: AssignDocumentDto, actor: AuthenticatedUser) {
    const roles = this.effectiveRoles(dto);
    const role = this.highestRole(roles);
    const document = await this.prisma.document.findUnique({
      where: { id: dto.documentId },
      select: { id: true, projectId: true }
    });
    if (!document) throw new NotFoundException("Document not found");

    if (actor.role !== "ADMIN") {
      await this.permissions.assertDocumentRole(actor, dto.documentId, ["MANAGER"]);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, ...this.accessibleUserScope(actor) }
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: dto.documentId, userId } },
      create: {
        documentId: dto.documentId,
        projectId: document.projectId,
        userId,
        role,
        roles,
        assignedBy: actor.id
      },
      update: {
        projectId: document.projectId,
        role,
        roles,
        assignedBy: actor.id
      }
    });
  }

  async assignDocumentsBatch(dto: AssignDocumentsBatchDto, actor: AuthenticatedUser) {
    const roles = this.effectiveRoles(dto);
    const role = this.highestRole(roles);
    const userIds = this.uniqueIds(dto.userIds);
    const documentIds = this.uniqueIds(dto.documentIds);
    if (!userIds.length || !documentIds.length) {
      throw new BadRequestException("Vui lòng chọn ít nhất một người dùng và một tài liệu");
    }

    const [usersCount, documents] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds }, deletedAt: null, ...this.accessibleUserScope(actor) } }),
      this.prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, projectId: true }
      })
    ]);
    if (usersCount !== userIds.length) throw new NotFoundException("Một hoặc nhiều người dùng không tồn tại");
    if (documents.length !== documentIds.length) throw new NotFoundException("Một hoặc nhiều tài liệu không tồn tại");

    if (actor.role !== "ADMIN") {
      await Promise.all(documentIds.map((documentId) => this.permissions.assertDocumentRole(actor, documentId, ["MANAGER"])));
    }

    const documentProjectMap = new Map(documents.map((document) => [document.id, document.projectId]));
    const operations = documentIds.flatMap((documentId) =>
      userIds.map((userId) =>
        this.prisma.documentPermission.upsert({
          where: { documentId_userId: { documentId, userId } },
          create: {
            documentId,
            projectId: documentProjectMap.get(documentId)!,
            userId,
            role,
            roles,
            assignedBy: actor.id
          },
          update: {
            projectId: documentProjectMap.get(documentId)!,
            role,
            roles,
            assignedBy: actor.id
          }
        })
      )
    );

    await this.prisma.$transaction(operations);
    return { ok: true, assigned: operations.length };
  }

  async removeDocument(userId: string, documentId: string, actor: AuthenticatedUser) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { projectId: true }
    });
    if (!document) throw new NotFoundException("Document not found");

    if (actor.role !== "ADMIN") {
      await this.permissions.assertDocumentRole(actor, documentId, ["MANAGER"]);
    }

    await this.prisma.documentPermission.deleteMany({ where: { userId, documentId } });
    return { ok: true };
  }

  private assertAdmin(actor: AuthenticatedUser) {
    if (actor.role !== "ADMIN") throw new ForbiddenException("Chỉ admin được thực hiện thao tác này");
  }

  private assertAdminOrManager(actor: AuthenticatedUser) {
    if (!["ADMIN", "MANAGER"].includes(actor.role)) {
      throw new ForbiddenException("Bạn không có quyền thực hiện thao tác này");
    }
  }

  private uniqueIds(ids: string[]) {
    return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  }

  private effectiveRoles(dto: { role?: ProjectRole; roles?: ProjectRole[] }) {
    const roles = [...(dto.roles ?? []), ...(dto.role ? [dto.role] : [])];
    const uniqueRoles = Array.from(new Set(roles));
    if (!uniqueRoles.length) throw new BadRequestException("Vui lòng chọn ít nhất một quyền hạn");
    return uniqueRoles;
  }

  private highestRole(roles: ProjectRole[]) {
    const roleRank: Record<ProjectRole, number> = {
      VIEWER: 1,
      REVIEWER: 2,
      EDITOR: 3,
      MANAGER: 4
    };
    return roles.reduce((highest, role) => (roleRank[role] > roleRank[highest] ? role : highest), roles[0]);
  }

  private permissionRoles(permission: { role: ProjectRole; roles?: ProjectRole[] | null }) {
    return permission.roles?.length ? permission.roles : [permission.role];
  }

  private mapExternalEmployee(employee: unknown, actor: AuthenticatedUser) {
    const source = this.isRecord(employee) ? employee : {};
    const externalRole = this.readString(source, ["role"]) ?? "employee";
    const role = this.mapExternalRole(externalRole);
    const externalUserId =
      this.readString(source, ["userId", "id", "_id", "employeeId"]) ??
      this.readString(source, ["email"]) ??
      randomUUID();
    const email = this.readString(source, ["email"]) ?? `${externalUserId}@external.local`;

    return {
      email,
      name: this.readString(source, ["fullName", "name", "username"]) ?? this.readString(source, ["email"]) ?? "VWork User",
      globalRole: role,
      externalUserId,
      externalRole,
      externalCompanyId: this.readString(source, [
        "companyId",
        "company.id",
        "company._id",
        "user.companyId",
        "employee.companyId",
        "employee.company.id"
      ]) ?? actor.externalCompanyId ?? null,
      externalDepartmentId: this.readString(source, [
        "departmentId",
        "department.id",
        "department._id",
        "user.departmentId",
        "employee.departmentId",
        "employee.department.id"
      ]) ?? null,
      deletedAt: null
    };
  }

  private mapExternalRole(role: string): GlobalRole {
    const normalized = role.toLowerCase();
    if (normalized === "sadmin" || normalized === "admin" || normalized.includes("admin")) return "ADMIN";
    if (normalized === "manager" || normalized.includes("manager") || normalized.includes("quan_ly")) return "MANAGER";
    return "EMPLOYEE";
  }

  private readString(source: Record<string, unknown>, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(source, path);
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return null;
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce<unknown>((current, key) => {
      if (!this.isRecord(current)) return undefined;
      return current[key];
    }, source);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private accessibleUserScope(actor: AuthenticatedUser): Prisma.UserWhereInput {
    if (actor.externalRole === "sadmin" || !actor.externalCompanyId) return {};
    if (actor.role === "ADMIN") return { externalCompanyId: actor.externalCompanyId };
    if (actor.externalDepartmentId) {
      return {
        externalCompanyId: actor.externalCompanyId,
        externalDepartmentId: actor.externalDepartmentId
      };
    }
    return { externalCompanyId: actor.externalCompanyId };
  }

  private managedUserInclude() {
    return {
      projectMemberships: {
        include: { project: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: "desc" as const }
      },
      documentPermissions: {
        include: { document: { select: { id: true, title: true, type: true, project: { select: { code: true } } } } },
        orderBy: { createdAt: "desc" as const }
      },
      _count: { select: { refreshSessions: true } }
    };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    name: string;
    globalRole: GlobalRole;
    externalRole?: string | null;
    externalCompanyId?: string | null;
    externalDepartmentId?: string | null;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.globalRole,
      externalRole: user.externalRole,
      externalCompanyId: user.externalCompanyId,
      externalDepartmentId: user.externalDepartmentId,
      status: user.status,
      createdAt: user.createdAt
    };
  }
}
