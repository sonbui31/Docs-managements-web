import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ProjectRole } from "@prisma/client";
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

  projectVisibilityWhere(user: AuthenticatedUser) {
    if (user.role === "ADMIN") return {};
    return { members: { some: { userId: user.id } } };
  }

  async assertCanCreateProject(user: AuthenticatedUser) {
    if (user.role !== "ADMIN" && user.role !== "MANAGER") {
      throw new ForbiddenException("Bạn không có quyền tạo dự án");
    }
  }

  async assertProjectRole(user: AuthenticatedUser, projectId: string, allowedRoles: ProjectRole[]) {
    if (user.role === "ADMIN") return;

    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } }
    });

    if (!membership || !this.roleAllowed(membership.role, allowedRoles)) {
      throw new ForbiddenException("Bạn không có quyền trên dự án này");
    }
  }

  async assertDocumentRole(user: AuthenticatedUser, documentId: string, allowedRoles: ProjectRole[]) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, projectId: true }
    });

    if (!document) {
      throw new NotFoundException("Document not found");
    }

    if (user.role === "ADMIN") return document;

    const documentPermission = await this.prisma.documentPermission.findUnique({
      where: { documentId_userId: { documentId, userId: user.id } }
    });

    if (documentPermission) {
      if (!this.roleAllowed(documentPermission.role, allowedRoles)) {
        throw new ForbiddenException("Bạn không có quyền trên tài liệu này");
      }
      return document;
    }

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
}
