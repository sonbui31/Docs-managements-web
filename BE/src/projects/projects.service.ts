import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {}

  findAll(user: AuthenticatedUser) {
    return this.prisma.project.findMany({
      where: this.permissions.projectVisibilityWhere(user),
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: {
            documents: { where: this.permissions.documentVisibilityWhere(user, undefined, ["VIEWER"]) },
            importJobs: true
          }
        }
      }
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectVisible(user, id);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: {
          where: this.permissions.documentVisibilityWhere(user, id, ["VIEWER"]),
          orderBy: { updatedAt: "desc" }
        },
        mediaAssets: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  async findMembers(id: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectVisible(user, id);

    const members = await this.prisma.projectMember.findMany({
      where: { projectId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            globalRole: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return members
      .filter((member) => member.user.status === "ACTIVE")
      .map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
        role: member.user.globalRole,
        projectRole: member.role,
        projectRoles: member.roles
      }));
  }

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    await this.permissions.assertCanCreateProject(user);

    try {
      return await this.prisma.$transaction(async (tx) => {
      const projectCode = await this.generateUniqueProjectCode(tx, dto.code, dto.name);
      const project = await tx.project.create({
        data: {
          ...dto,
          code: projectCode,
          name: dto.name.trim(),
          client: dto.client?.trim(),
          description: dto.description?.trim(),
          externalCompanyId: dto.externalCompanyId?.trim() || user.externalCompanyId || null,
          externalDepartmentId: dto.externalDepartmentId?.trim() || user.externalDepartmentId || null
        }
      });
      if (user.role === "MANAGER") {
        await tx.projectMember.create({
          data: {
            projectId: project.id,
            userId: user.id,
            role: "MANAGER",
            assignedBy: user.id
          }
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "PROJECT_CREATED",
          entityType: "Project",
          entityId: project.id,
          metadata: { projectId: project.id, code: project.code, name: project.name }
        }
      });
      return project;
    });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Mã dự án đã tồn tại, vui lòng thử mã khác");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, id, ["MANAGER"]);

    const project = await this.prisma.project.findUnique({ where: { id }, select: { id: true } });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("No project fields to update");
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          name: dto.name?.trim(),
          client: dto.client?.trim(),
          description: dto.description?.trim(),
          externalCompanyId: dto.externalCompanyId?.trim(),
          externalDepartmentId: dto.externalDepartmentId?.trim()
        }
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "PROJECT_UPDATED",
          entityType: "Project",
          entityId: id,
          metadata: { projectId: id, code: updated.code, name: updated.name }
        }
      });
      return updated;
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, id, ["MANAGER"]);

    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "PROJECT_DELETED",
          entityType: "Project",
          entityId: id,
          metadata: { projectId: id }
        }
      });
      await tx.project.delete({ where: { id } });
    });
    return { ok: true };
  }

  private async generateUniqueProjectCode(
    tx: Prisma.TransactionClient,
    requestedCode: string | undefined,
    projectName: string
  ) {
    const base = this.normalizeProjectCode(requestedCode || projectName);
    const existingCodes = await tx.project.findMany({
      where: { code: { startsWith: base } },
      select: { code: true }
    });
    const existing = new Set(existingCodes.map((project) => project.code.toUpperCase()));
    if (!existing.has(base)) return base;

    let suffix = 1;
    let candidate = `${base}-${String(suffix).padStart(2, "0")}`;
    while (existing.has(candidate)) {
      suffix += 1;
      candidate = `${base}-${String(suffix).padStart(2, "0")}`;
    }
    return candidate;
  }

  private normalizeProjectCode(value: string) {
    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toUpperCase()
      .slice(0, 24);
    return normalized || "PROJECT";
  }
}
