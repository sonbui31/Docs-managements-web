import { BadGatewayException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalRole } from "@prisma/client";

type ExternalAuthUser = {
  externalUserId: string;
  email: string;
  name: string;
  role: GlobalRole;
  externalRole: string;
  externalCompanyId: string | null;
  externalDepartmentId: string | null;
  raw: unknown;
};

type ExternalLoginResult = {
  accessToken: string;
  refreshToken?: string;
  user: ExternalAuthUser;
};

type ExternalTokenResult = {
  accessToken: string;
  refreshToken?: string;
};

@Injectable()
export class ExternalAuthService {
  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return this.config.get<string>("AUTH_PROVIDER") === "external";
  }

  async login(email: string, password: string): Promise<ExternalLoginResult> {
    const loginResponse = await this.request<unknown>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }, false);

    const accessToken = this.extractToken(loginResponse, ["accessToken", "access_token", "token"]);
    const refreshToken = this.extractToken(loginResponse, ["refreshToken", "refresh_token"]);
    if (!accessToken) {
      throw new BadGatewayException("Integrated Auth login response is missing accessToken");
    }

    const meResponse = await this.request<unknown>("/user/me", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      accessToken,
      refreshToken: refreshToken ?? undefined,
      user: this.normalizeUser(meResponse, email)
    };
  }

  async logout(refreshToken: string | undefined, accessToken?: string) {
    if (!refreshToken) return;
    await this.request<unknown>("/auth/logout", {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      body: JSON.stringify({ refreshToken })
    }).catch(() => null);
  }

  async refresh(refreshToken: string): Promise<ExternalTokenResult> {
    const response = await this.request<unknown>("/auth/refresh-token", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });

    const accessToken = this.extractToken(response, ["accessToken", "access_token", "token"]);
    const nextRefreshToken = this.extractToken(response, ["refreshToken", "refresh_token"]);
    if (!accessToken) {
      throw new BadGatewayException("Integrated Auth refresh response is missing accessToken");
    }

    return {
      accessToken,
      refreshToken: nextRefreshToken ?? refreshToken
    };
  }

  async fetchEmployeeUserList(accessToken: string, params: { companyId?: string | null }) {
    const search = new URLSearchParams();
    if (params.companyId) search.set("companyId", params.companyId);
    const response = await this.request<unknown>(`/employee/user-list${search.size ? `?${search}` : ""}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = this.unwrapData(response);
    return Array.isArray(data) ? data : [];
  }

  private async request<T>(path: string, init: RequestInit, requireAuthHeader = true): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const apiKey = this.config.get<string>("EXTERNAL_AUTH_API_KEY");
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "api-key": apiKey } : {}),
        ...(requireAuthHeader ? {} : {}),
        ...init.headers
      }
    });

    if (response.status === 401) {
      throw new UnauthorizedException("Integrated Auth rejected credentials");
    }
    if (!response.ok) {
      const message = await response.text();
      throw new BadGatewayException(message || `Integrated Auth error ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  private normalizeUser(response: unknown, fallbackEmail: string): ExternalAuthUser {
    const data = this.unwrapData(response);
    const email = this.readString(data, ["email", "user.email"]) ?? fallbackEmail;
    const externalRole = (this.readString(data, ["role", "user.role", "account.role"]) ?? "employee").toLowerCase();
    const name =
      this.readString(data, ["fullName", "name", "username", "user.fullName", "user.name", "user.username"]) ??
      email;

    return {
      externalUserId: this.readString(data, ["id", "_id", "userId", "user.id", "user._id"]) ?? email,
      email,
      name,
      role: this.mapExternalRole(externalRole),
      externalRole,
      externalCompanyId: this.readString(data, [
        "companyId",
        "company.id",
        "company._id",
        "user.companyId",
        "employee.companyId",
        "employee.company.id"
      ]),
      externalDepartmentId: this.readString(data, [
        "departmentId",
        "department.id",
        "department._id",
        "user.departmentId",
        "employee.departmentId",
        "employee.department.id"
      ]),
      raw: response
    };
  }

  private mapExternalRole(role: string): GlobalRole {
    if (role === "sadmin" || role === "admin") return "ADMIN";
    if (role === "manager") return "MANAGER";
    return "EMPLOYEE";
  }

  private extractToken(response: unknown, keys: string[]) {
    const data = this.unwrapData(response);
    for (const key of keys) {
      const value = this.readString(data, [key, `data.${key}`, `tokens.${key}`, `auth.${key}`]);
      if (value) return value;
    }
    return null;
  }

  private unwrapData(value: unknown): unknown {
    if (!this.isRecord(value)) return value;
    if (this.isRecord(value.data)) return value.data;
    if (this.isRecord(value.result)) return value.result;
    return value;
  }

  private readString(source: unknown, paths: string[]) {
    for (const path of paths) {
      const value = this.readPath(source, path);
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return null;
  }

  private readPath(source: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>((current, key) => {
      if (!this.isRecord(current)) return undefined;
      return current[key];
    }, source);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  private getBaseUrl() {
    const value = this.config.get<string>("EXTERNAL_AUTH_BASE_URL");
    if (!value) {
      throw new BadGatewayException("Missing EXTERNAL_AUTH_BASE_URL");
    }
    return value.replace(/\/+$/, "").replace(/\/api\/v1$/, "") + "/api/v1";
  }
}
