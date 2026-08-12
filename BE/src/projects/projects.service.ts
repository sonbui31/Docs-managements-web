import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
          select: { documents: true, importJobs: true }
        }
      }
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, id, ["VIEWER"]);

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        documents: { orderBy: { updatedAt: "desc" } },
        mediaAssets: { orderBy: { createdAt: "desc" }, take: 20 }
      }
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  async create(dto: CreateProjectDto, user: AuthenticatedUser) {
    await this.permissions.assertCanCreateProject(user);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...dto,
          code: dto.code.trim().toUpperCase(),
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
}
