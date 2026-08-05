import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, ProjectRole } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const roleRank: Record<ProjectRole, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  EDITOR: 3,
  MANAGER: 4
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  projectVisibilityWhere(user: AuthenticatedUser): Prisma.ProjectWhereInput {
    if (this.isExternalSuperAdmin(user)) return {};

    if (!user.externalCompanyId) {
      if (user.role === "ADMIN") return {};
      return { members: { some: { userId: user.id } } };
    }

    if (user.role === "ADMIN") {
      return {
        OR: [
          { externalCompanyId: user.externalCompanyId },
          { members: { some: { userId: user.id } } }
        ]
      };
    }

    const scopedProjects: Prisma.ProjectWhereInput = {
      externalCompanyId: user.externalCompanyId,
      OR: [
        { externalDepartmentId: null },
        ...(user.externalDepartmentId ? [{ externalDepartmentId: user.externalDepartmentId }] : [])
      ]
    };

    return {
      OR: [
        scopedProjects,
        { members: { some: { userId: user.id } } }
      ]
    };
  }

  async assertCanCreateProject(user: AuthenticatedUser) {
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      throw new ForbiddenException("Bạn không có quyền tạo dự án");
    }
  }

  async assertProjectRole(user: AuthenticatedUser, projectId: string, allowedRoles: ProjectRole[]) {
    if (this.isExternalSuperAdmin(user)) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        externalCompanyId: true,
        externalDepartmentId: true,
        members: {
          where: { userId: user.id },
          select: { role: true },
          take: 1
        }
      }
    });
    if (!project) throw new NotFoundException("Project not found");

    const membershipRole = project.members[0]?.role;
    const scopedRole = this.scopeRoleFor(user, project);
    const effectiveRole = this.highestRole(membershipRole, scopedRole);

    if (!effectiveRole || !this.roleAllowed(effectiveRole, allowedRoles)) {
      throw new ForbiddenException("Bạn không có quyền trên dự án này");
    }
  }

  async assertDocumentRole(user: AuthenticatedUser, documentId: string, allowedRoles: ProjectRole[]) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        projectId: true,
        externalCompanyId: true,
        externalDepartmentId: true,
        project: {
          select: {
            externalCompanyId: true,
            externalDepartmentId: true
          }
        }
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    if (this.isExternalSuperAdmin(user)) return document;

    const documentPermission = await this.prisma.documentPermission.findUnique({
      where: { documentId_userId: { documentId, userId: user.id } }
    });

    if (documentPermission) {
      if (!this.roleAllowed(documentPermission.role, allowedRoles)) {
        throw new ForbiddenException("Bạn không có quyền trên tài liệu này");
      }
      return document;
    }

    const scopedRole = this.scopeRoleFor(user, {
      externalCompanyId: document.externalCompanyId ?? document.project.externalCompanyId,
      externalDepartmentId: document.externalDepartmentId ?? document.project.externalDepartmentId
    });
    if (scopedRole && this.roleAllowed(scopedRole, allowedRoles)) return document;

    await this.assertProjectRole(user, document.projectId, allowedRoles);
    return document;
  }

  async assertCommentRole(user: AuthenticatedUser, commentId: string, allowedRoles: ProjectRole[]) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { documentId: true }
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    return this.assertDocumentRole(user, comment.documentId, allowedRoles);
  }

  private roleAllowed(actual: ProjectRole, allowedRoles: ProjectRole[]) {
    const minimumRank = Math.min(...allowedRoles.map((role) => roleRank[role]));
    return roleRank[actual] >= minimumRank;
  }

  private isExternalSuperAdmin(user: AuthenticatedUser) {
    return user.externalRole === "sadmin";
  }

  private scopeRoleFor(
    user: AuthenticatedUser,
    scope: { externalCompanyId: string | null; externalDepartmentId: string | null }
  ): ProjectRole | null {
    if (!scope.externalCompanyId || !user.externalCompanyId) {
      return user.role === "ADMIN" ? "MANAGER" : null;
    }
    if (scope.externalCompanyId !== user.externalCompanyId) return null;
    if (user.role === "ADMIN") return "MANAGER";

    const sameDepartment =
      !scope.externalDepartmentId ||
      (Boolean(user.externalDepartmentId) && scope.externalDepartmentId === user.externalDepartmentId);
    if (!sameDepartment) return null;
    if (user.role === "MANAGER") return "MANAGER";
    return "VIEWER";
  }

  private highestRole(left?: ProjectRole | null, right?: ProjectRole | null) {
    if (!left) return right ?? null;
    if (!right) return left;
    return roleRank[left] >= roleRank[right] ? left : right;
  }
}
