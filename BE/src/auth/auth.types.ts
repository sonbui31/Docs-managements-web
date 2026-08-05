import { GlobalRole, UserStatus } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: GlobalRole;
  externalRole?: string | null;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
  externalAccessToken?: string | null;
  exp: number;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: GlobalRole;
  externalRole?: string | null;
  externalCompanyId?: string | null;
  externalDepartmentId?: string | null;
  externalAccessToken?: string | null;
  status: UserStatus;
};

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};
