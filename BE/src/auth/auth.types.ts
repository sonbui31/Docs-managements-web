import { GlobalRole, UserStatus } from "@prisma/client";

export type JwtPayload = {
  sub: string;
  email: string;
  role: GlobalRole;
  exp: number;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: GlobalRole;
  status: UserStatus;
};

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};
