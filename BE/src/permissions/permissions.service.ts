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
      return {
        OR: [
          { members: { some: { userId: user.id } } },
          { documentPermissions: { some: { userId: user.id } } }
        ]
      };
    }

    if (user.role === "ADMIN") {
      return {
        OR: [
          { externalCompanyId: user.externalCompanyId },
          { members: { some: { userId: user.id } } },
          { documentPermissions: { some: { userId: user.id } } }
        ]
      };
    }

    const assignedProjects: Prisma.ProjectWhereInput[] = [
      { members: { some: { userId: user.id } } },
      { documentPermissions: { some: { userId: user.id } } }
    ];

    if (user.role !== "MANAGER") {
      return { OR: assignedProjects };
    }

    return {
      OR: [
        {
          externalCompanyId: user.externalCompanyId,
          OR: [
            { externalDepartmentId: null },
            ...(user.externalDepartmentId ? [{ externalDepartmentId: user.externalDepartmentId }] : [])
          ]
        },
        ...assignedProjects
      ]
    };
  }

  documentVisibilityWhere(
    user: AuthenticatedUser,
    projectId?: string,
    allowedRoles: ProjectRole[] = ["VIEWER"]
  ): Prisma.DocumentWhereInput {
    const projectScope = projectId ? { projectId } : {};
    if (this.isExternalSuperAdmin(user)) return projectScope;

    const acceptedRoles = this.rolesAtLeast(allowedRoles);
    const directAccess: Prisma.DocumentWhereInput[] = [
      {
        permissions: {
          some: {
            userId: user.id,
            OR: [
              { role: { in: acceptedRoles } },
              { roles: { hasSome: acceptedRoles } }
            ]
          }
        }
      },
      {
        project: {
          members: {
            some: {
              userId: user.id,
              OR: [
                { role: { in: acceptedRoles } },
                { roles: { hasSome: acceptedRoles } }
              ]
            }
          }
        }
      }
    ];
    const scopedAccess = this.documentScopedAccessWhere(user, allowedRoles);
    if (scopedAccess) directAccess.push(scopedAccess);

    return {
      ...projectScope,
      OR: directAccess
    };
  }

  async assertProjectVisible(user: AuthenticatedUser, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.projectVisibilityWhere(user)
      },
      select: { id: true }
    });
    if (!project) throw new ForbiddenException("Bạn không có quyền xem dự án này");
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
          select: { role: true, roles: true },
          take: 1
        }
      }
    });
    if (!project) throw new NotFoundException("Project not found");

    const membershipRole = this.highestStoredRole(project.members[0]);
    const scopedRole = this.scopeRoleFor(user, project);
    const effectiveRole = this.highestRole(membershipRole, scopedRole);

    const membershipRoles = project.members[0] ? this.storedRoles(project.members[0]) : [];
    if (
      !this.rolesAllowed([...membershipRoles, ...(scopedRole ? [scopedRole] : [])], allowedRoles) &&
      (!effectiveRole || !this.roleAllowed(effectiveRole, allowedRoles))
    ) {
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
      if (!this.rolesAllowed(this.storedRoles(documentPermission), allowedRoles)) {
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

  private rolesAllowed(actualRoles: ProjectRole[], allowedRoles: ProjectRole[]) {
    return actualRoles.some((role) => this.roleAllowed(role, allowedRoles));
  }

  private rolesAtLeast(allowedRoles: ProjectRole[]) {
    const minimumRank = Math.min(...allowedRoles.map((role) => roleRank[role]));
    return (Object.keys(roleRank) as ProjectRole[]).filter((role) => roleRank[role] >= minimumRank);
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
    return null;
  }

  private documentScopedAccessWhere(user: AuthenticatedUser, allowedRoles: ProjectRole[]): Prisma.DocumentWhereInput | null {
    if (!user.externalCompanyId) {
      return user.role === "ADMIN" ? {} : null;
    }
    if (user.role === "ADMIN") {
      return { externalCompanyId: user.externalCompanyId };
    }
    if (user.role === "MANAGER") {
      return {
        externalCompanyId: user.externalCompanyId,
        OR: [
          { externalDepartmentId: null },
          ...(user.externalDepartmentId ? [{ externalDepartmentId: user.externalDepartmentId }] : [])
        ]
      };
    }
    return null;
  }

  private highestRole(left?: ProjectRole | null, right?: ProjectRole | null) {
    if (!left) return right ?? null;
    if (!right) return left;
    return roleRank[left] >= roleRank[right] ? left : right;
  }

  private highestStoredRole(permission?: { role: ProjectRole; roles?: ProjectRole[] | null }) {
    const roles = this.storedRoles(permission);
    if (!roles.length) return null;
    return roles.reduce((highest, role) => (roleRank[role] > roleRank[highest] ? role : highest), roles[0]);
  }

  private storedRoles(permission?: { role: ProjectRole; roles?: ProjectRole[] | null }) {
    if (!permission) return [];
    return permission.roles?.length ? permission.roles : [permission.role];
  }
}
