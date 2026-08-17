import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { GlobalRole, UserStatus } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";

jest.mock("../collaboration/collaboration.service", () => ({
  CollaborationService: class {}
}));

import { WorkItemsService } from "./work-items.service";

const owner: AuthenticatedUser = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  role: GlobalRole.EMPLOYEE,
  status: UserStatus.ACTIVE
};

const teammate: AuthenticatedUser = {
  id: "user-2",
  email: "user2@example.com",
  name: "User 2",
  role: GlobalRole.EMPLOYEE,
  status: UserStatus.ACTIVE
};

function serviceHarness() {
  const prisma = {
    workItem: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    workItemComment: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    document: {
      findUnique: jest.fn()
    },
    comment: {
      findUnique: jest.fn()
    }
  };
  const permissions = {
    assertProjectRole: jest.fn().mockResolvedValue(undefined),
    assertDocumentRole: jest.fn().mockResolvedValue(undefined)
  };
  const collaboration = {
    log: jest.fn().mockResolvedValue(undefined)
  };
  const media = {
    upload: jest.fn()
  };
  const service = new WorkItemsService(prisma as any, permissions as any, collaboration as any, media as any);
  return { service, prisma, permissions, collaboration, media };
}

describe("WorkItemsService permissions", () => {
  it("allows any permitted teammate to change only ticket status", async () => {
    const { service, prisma } = serviceHarness();
    prisma.workItem.findUnique.mockResolvedValue({
      id: "wi-1",
      projectId: "project-1",
      documentId: null,
      sourceCommentId: null,
      createdById: owner.id,
      createdByEmail: owner.email
    });
    prisma.workItem.update.mockResolvedValue({ id: "wi-1", status: "DONE", priority: "MEDIUM" });

    await expect(service.update("wi-1", { status: "DONE" } as any, teammate)).resolves.toMatchObject({ status: "DONE" });
    expect(prisma.workItem.update).toHaveBeenCalled();
  });

  it("denies non-owner edits that change ticket content", async () => {
    const { service, prisma } = serviceHarness();
    prisma.workItem.findUnique.mockResolvedValue({
      id: "wi-1",
      projectId: "project-1",
      documentId: null,
      sourceCommentId: null,
      createdById: owner.id,
      createdByEmail: owner.email
    });

    await expect(service.update("wi-1", { title: "New title" } as any, teammate)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it("still denies status changes when the user lacks board permission", async () => {
    const { service, prisma, permissions } = serviceHarness();
    permissions.assertProjectRole.mockRejectedValue(new ForbiddenException("denied"));
    prisma.workItem.findUnique.mockResolvedValue({
      id: "wi-1",
      projectId: "project-1",
      documentId: null,
      sourceCommentId: null,
      createdById: owner.id,
      createdByEmail: owner.email
    });

    await expect(service.update("wi-1", { status: "DONE" } as any, teammate)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workItem.update).not.toHaveBeenCalled();
  });

  it("denies non-owner updates to ticket comments", async () => {
    const { service, prisma } = serviceHarness();
    prisma.workItemComment.findUnique.mockResolvedValue({
      id: "comment-1",
      workItemId: "wi-1",
      createdById: owner.id,
      createdByEmail: owner.email,
      workItem: { projectId: "project-1" }
    });

    await expect(service.updateComment("wi-1", "comment-1", { content: "Changed" }, teammate)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workItemComment.update).not.toHaveBeenCalled();
  });

  it("prevents deleting an owned ticket comment when another user already replied", async () => {
    const { service, prisma } = serviceHarness();
    prisma.workItemComment.findUnique.mockResolvedValue({
      id: "comment-1",
      workItemId: "wi-1",
      createdById: owner.id,
      createdByEmail: owner.email,
      workItem: { projectId: "project-1" }
    });
    prisma.workItemComment.count.mockResolvedValue(1);

    await expect(service.removeComment("wi-1", "comment-1", owner)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workItemComment.delete).not.toHaveBeenCalled();
  });
});
