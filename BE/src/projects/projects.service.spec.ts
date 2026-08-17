import { ForbiddenException } from "@nestjs/common";
import { GlobalRole, UserStatus } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { ProjectsService } from "./projects.service";

const user: AuthenticatedUser = {
  id: "user-1",
  email: "user1@example.com",
  name: "User 1",
  role: GlobalRole.EMPLOYEE,
  status: UserStatus.ACTIVE
};

describe("ProjectsService permissions", () => {
  it("requires project-level VIEWER permission before exposing project members", async () => {
    const prisma = {
      projectMember: { findMany: jest.fn() }
    };
    const permissions = {
      assertProjectRole: jest.fn().mockRejectedValue(new ForbiddenException("denied")),
      assertProjectVisible: jest.fn()
    };
    const service = new ProjectsService(prisma as any, permissions as any);

    await expect(service.findMembers("project-1", user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(permissions.assertProjectRole).toHaveBeenCalledWith(user, "project-1", ["VIEWER"]);
    expect(permissions.assertProjectVisible).not.toHaveBeenCalled();
    expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
  });

  it("returns only active project members after permission passes", async () => {
    const prisma = {
      projectMember: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: "MANAGER",
            roles: ["VIEWER", "MANAGER"],
            user: { id: "u1", name: "Active", email: "active@example.com", globalRole: "EMPLOYEE", status: "ACTIVE" }
          },
          {
            role: "VIEWER",
            roles: ["VIEWER"],
            user: { id: "u2", name: "Disabled", email: "disabled@example.com", globalRole: "EMPLOYEE", status: "DISABLED" }
          }
        ])
      }
    };
    const permissions = {
      assertProjectRole: jest.fn().mockResolvedValue(undefined)
    };
    const service = new ProjectsService(prisma as any, permissions as any);

    await expect(service.findMembers("project-1", user)).resolves.toEqual([
      {
        id: "u1",
        name: "Active",
        email: "active@example.com",
        role: "EMPLOYEE",
        projectRole: "MANAGER",
        projectRoles: ["VIEWER", "MANAGER"]
      }
    ]);
  });
});
