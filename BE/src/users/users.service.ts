import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GlobalRole, ProjectRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { AssignDocumentDto } from "./dto/assign-document.dto";
import { AssignDocumentsBatchDto } from "./dto/assign-documents-batch.dto";
import { AssignProjectDto } from "./dto/assign-project.dto";
import { AssignProjectsBatchDto } from "./dto/assign-projects-batch.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  async findAll(actor: AuthenticatedUser) {
    this.assertAdmin(actor);

    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        projectMemberships: {
          include: { project: { select: { id: true, code: true, name: true } } },
          orderBy: { createdAt: "desc" }
        },
        documentPermissions: {
          include: { document: { select: { id: true, title: true, type: true, project: { select: { code: true } } } } },
          orderBy: { createdAt: "desc" }
        },
        _count: { select: { refreshSessions: true } }
      }
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.globalRole,
      status: user.status,
      createdAt: user.createdAt,
      sessions: user._count.refreshSessions,
      projects: user.projectMemberships.map((membership) => ({
        projectId: membership.projectId,
        role: membership.role,
        code: membership.project.code,
        name: membership.project.name
      })),
      documents: user.documentPermissions.map((permission) => ({
        documentId: permission.documentId,
        projectId: permission.projectId,
        role: permission.role,
        title: permission.document.title,
        type: permission.document.type,
        projectCode: permission.document.project.code
      }))
    }));
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
    const role = this.effectiveRole(dto);
    if (actor.role !== "ADMIN") {
      const managerMembership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: dto.projectId, userId: actor.id } }
      });
      if (!managerMembership || managerMembership.role !== "MANAGER") {
        throw new ForbiddenException("Bạn không có quyền gán thành viên vào dự án này");
      }
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: dto.projectId, userId } },
      create: { projectId: dto.projectId, userId, role, assignedBy: actor.id },
      update: { role, assignedBy: actor.id }
    });
  }

  async assignProjectsBatch(dto: AssignProjectsBatchDto, actor: AuthenticatedUser) {
    const role = this.effectiveRole(dto);
    const userIds = this.uniqueIds(dto.userIds);
    const projectIds = this.uniqueIds(dto.projectIds);
    if (!userIds.length || !projectIds.length) {
      throw new BadRequestException("Vui lòng chọn ít nhất một người dùng và một dự án");
    }

    if (actor.role !== "ADMIN") {
      await Promise.all(projectIds.map((projectId) => this.permissions.assertProjectRole(actor, projectId, ["MANAGER"])));
    }

    const [usersCount, projectsCount] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds }, deletedAt: null } }),
      this.prisma.project.count({ where: { id: { in: projectIds } } })
    ]);
    if (usersCount !== userIds.length) throw new NotFoundException("Một hoặc nhiều người dùng không tồn tại");
    if (projectsCount !== projectIds.length) throw new NotFoundException("Một hoặc nhiều dự án không tồn tại");

    const operations = projectIds.flatMap((projectId) =>
      userIds.map((userId) =>
        this.prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role, assignedBy: actor.id },
          update: { role, assignedBy: actor.id }
        })
      )
    );

    await this.prisma.$transaction(operations);
    return { ok: true, assigned: operations.length };
  }

  async removeProject(userId: string, projectId: string, actor: AuthenticatedUser) {
    this.assertAdminOrManager(actor);
    await this.prisma.projectMember.deleteMany({ where: { userId, projectId } });
    return { ok: true };
  }

  async assignDocument(userId: string, dto: AssignDocumentDto, actor: AuthenticatedUser) {
    const role = this.effectiveRole(dto);
    const document = await this.prisma.document.findUnique({
      where: { id: dto.documentId },
      select: { id: true, projectId: true }
    });
    if (!document) throw new NotFoundException("Document not found");

    if (actor.role !== "ADMIN") {
      await this.permissions.assertProjectRole(actor, document.projectId, ["MANAGER"]);
    }

    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: dto.documentId, userId } },
      create: {
        documentId: dto.documentId,
        projectId: document.projectId,
        userId,
        role,
        assignedBy: actor.id
      },
      update: {
        projectId: document.projectId,
        role,
        assignedBy: actor.id
      }
    });
  }

  async assignDocumentsBatch(dto: AssignDocumentsBatchDto, actor: AuthenticatedUser) {
    const role = this.effectiveRole(dto);
    const userIds = this.uniqueIds(dto.userIds);
    const documentIds = this.uniqueIds(dto.documentIds);
    if (!userIds.length || !documentIds.length) {
      throw new BadRequestException("Vui lòng chọn ít nhất một người dùng và một tài liệu");
    }

    const [usersCount, documents] = await Promise.all([
      this.prisma.user.count({ where: { id: { in: userIds }, deletedAt: null } }),
      this.prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, projectId: true }
      })
    ]);
    if (usersCount !== userIds.length) throw new NotFoundException("Một hoặc nhiều người dùng không tồn tại");
    if (documents.length !== documentIds.length) throw new NotFoundException("Một hoặc nhiều tài liệu không tồn tại");

    if (actor.role !== "ADMIN") {
      const projectIds = this.uniqueIds(documents.map((document) => document.projectId));
      await Promise.all(projectIds.map((projectId) => this.permissions.assertProjectRole(actor, projectId, ["MANAGER"])));
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
            assignedBy: actor.id
          },
          update: {
            projectId: documentProjectMap.get(documentId)!,
            role,
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
      await this.permissions.assertProjectRole(actor, document.projectId, ["MANAGER"]);
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

  private effectiveRole(dto: { role?: ProjectRole; roles?: ProjectRole[] }) {
    const roleRank: Record<ProjectRole, number> = {
      VIEWER: 1,
      REVIEWER: 2,
      EDITOR: 3,
      MANAGER: 4
    };
    const roles = [...(dto.roles ?? []), ...(dto.role ? [dto.role] : [])];
    const uniqueRoles = Array.from(new Set(roles));
    if (!uniqueRoles.length) throw new BadRequestException("Vui lòng chọn ít nhất một quyền hạn");

    return uniqueRoles.reduce((highest, role) => (roleRank[role] > roleRank[highest] ? role : highest), uniqueRoles[0]);
  }

  private toPublicUser(user: { id: string; email: string; name: string; globalRole: GlobalRole; status: string; createdAt: Date }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.globalRole,
      status: user.status,
      createdAt: user.createdAt
    };
  }
}
