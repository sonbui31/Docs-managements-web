import { ForbiddenException } from "@nestjs/common";
import { GlobalRole, UserStatus } from "@prisma/client";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "./permissions.service";

const baseUser: AuthenticatedUser = {
  id: "user-1",
  email: "user1@example.com",
  name: "User 1",
  role: GlobalRole.EMPLOYEE,
  status: UserStatus.ACTIVE
};

function prismaMock() {
  return {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn()
    },
    document: {
      findUnique: jest.fn()
    },
    documentPermission: {
      findUnique: jest.fn()
    },
    comment: {
      findUnique: jest.fn()
    }
  };
}

describe("PermissionsService", () => {
  it("allows a project role stored in the roles array even when legacy role is lower", async () => {
    const prisma = prismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      externalCompanyId: null,
      externalDepartmentId: null,
      members: [{ role: "VIEWER", roles: ["VIEWER", "EDITOR"] }]
    });
    const service = new PermissionsService(prisma as any);

    await expect(service.assertProjectRole(baseUser, "project-1", ["EDITOR"])).resolves.toBeUndefined();
  });

  it("denies project access when the user only has direct document permission", async () => {
    const prisma = prismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: "project-1",
      externalCompanyId: null,
      externalDepartmentId: null,
      members: []
    });
    const service = new PermissionsService(prisma as any);

    await expect(service.assertProjectRole(baseUser, "project-1", ["VIEWER"])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows direct document permission for viewer but not editor operations", async () => {
    const prisma = prismaMock();
    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      projectId: "project-1",
      externalCompanyId: null,
      externalDepartmentId: null,
      project: { externalCompanyId: null, externalDepartmentId: null }
    });
    prisma.documentPermission.findUnique.mockResolvedValue({ role: "VIEWER", roles: ["VIEWER"] });
    const service = new PermissionsService(prisma as any);

    await expect(service.assertDocumentRole(baseUser, "doc-1", ["VIEWER"])).resolves.toMatchObject({ id: "doc-1" });
    await expect(service.assertDocumentRole(baseUser, "doc-1", ["EDITOR"])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows the document owner to manage the document without a permission row", async () => {
    const prisma = prismaMock();
    prisma.document.findUnique.mockResolvedValue({
      id: "doc-owned",
      projectId: "project-1",
      ownerId: baseUser.id,
      externalCompanyId: null,
      externalDepartmentId: null,
      project: { externalCompanyId: null, externalDepartmentId: null }
    });
    const service = new PermissionsService(prisma as any);

    await expect(service.assertDocumentRole(baseUser, "doc-owned", ["MANAGER"])).resolves.toMatchObject({ id: "doc-owned" });
    expect(prisma.documentPermission.findUnique).not.toHaveBeenCalled();
  });

  it("scopes external admins to their company instead of granting cross-company access", async () => {
    const prisma = prismaMock();
    const admin: AuthenticatedUser = {
      ...baseUser,
      id: "admin-1",
      role: GlobalRole.ADMIN,
      externalCompanyId: "company-a"
    };
    const service = new PermissionsService(prisma as any);

    prisma.project.findUnique.mockResolvedValueOnce({
      id: "project-a",
      externalCompanyId: "company-a",
      externalDepartmentId: null,
      members: []
    });
    await expect(service.assertProjectRole(admin, "project-a", ["MANAGER"])).resolves.toBeUndefined();

    prisma.project.findUnique.mockResolvedValueOnce({
      id: "project-b",
      externalCompanyId: "company-b",
      externalDepartmentId: null,
      members: []
    });
    await expect(service.assertProjectRole(admin, "project-b", ["VIEWER"])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("keeps external super admin as an explicit global bypass", async () => {
    const prisma = prismaMock();
    const superAdmin: AuthenticatedUser = {
      ...baseUser,
      id: "sadmin-1",
      role: GlobalRole.ADMIN,
      externalRole: "sadmin"
    };
    const service = new PermissionsService(prisma as any);

    await expect(service.assertProjectRole(superAdmin, "any-project", ["MANAGER"])).resolves.toBeUndefined();
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
  });
});
