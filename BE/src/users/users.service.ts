import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GlobalRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../auth/auth.types";
import { AssignProjectDto } from "./dto/assign-project.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
      create: { projectId: dto.projectId, userId, role: dto.role, assignedBy: actor.id },
      update: { role: dto.role, assignedBy: actor.id }
    });
  }

  async removeProject(userId: string, projectId: string, actor: AuthenticatedUser) {
    this.assertAdminOrManager(actor);
    await this.prisma.projectMember.deleteMany({ where: { userId, projectId } });
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
