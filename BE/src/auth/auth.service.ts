import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GlobalRole, TokenType, User, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { TokenDto } from "./dto/token.dto";
import { ExternalAuthService } from "./external-auth.service";
import { JwtPayload, RequestMeta } from "./auth.types";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const OTP_TTL_MINUTES = 10;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly externalAuth: ExternalAuthService
  ) {}

  async onModuleInit() {
    await this.seedAdmin();
  }

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) {
      throw new BadRequestException("Email này đã được đăng ký");
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await this.hashPassword(dto.password),
        globalRole: "EMPLOYEE",
        status: "ACTIVE",
        emailConfirmedAt: new Date()
      }
    });

    await this.createVerificationToken(user.id, "EMAIL_CONFIRMATION");
    await this.audit("auth.register", user.id, "User", user.id, { email }, meta);
    return this.toPublicUser(user);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = this.normalizeEmail(dto.email);
    if (this.externalAuth.isEnabled()) {
      return this.loginWithExternalProvider(email, dto.password, meta);
    }

    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });

    if (!user) {
      await this.audit("auth.login_failed", null, "User", null, { email, reason: "not_found" }, meta);
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }

    this.assertCanLogin(user);

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      await this.recordFailedLogin(user, meta);
      throw new UnauthorizedException("Email hoặc mật khẩu không chính xác");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, status: "ACTIVE" }
    });
    const refreshToken = await this.createRefreshSession(updatedUser, meta);
    await this.audit("auth.login_success", updatedUser.id, "User", updatedUser.id, null, meta);

    return {
      user: this.toPublicUser(updatedUser),
      accessToken: this.signAccessToken(updatedUser),
      refreshToken
    };
  }

  async refresh(refreshToken: string | undefined, meta: RequestMeta) {
    if (!refreshToken) {
      throw new UnauthorizedException("Missing refresh token");
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.deletedAt) {
      throw new UnauthorizedException("Refresh session is invalid");
    }

    this.assertCanLogin(session.user);

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), userAgent: meta.userAgent, ipAddress: meta.ipAddress }
    });

    await this.audit("auth.refresh", session.userId, "RefreshSession", session.id, null, meta);
    return {
      user: this.toPublicUser(session.user),
      accessToken: this.signAccessToken(session.user)
    };
  }

  async logout(refreshToken: string | undefined, actorId: string | undefined, meta: RequestMeta) {
    if (refreshToken) {
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() }
      });
    }

    await this.audit("auth.logout", actorId ?? null, "User", actorId ?? null, null, meta);
  }

  async logoutAll(actorId: string, meta: RequestMeta) {
    await this.prisma.refreshSession.updateMany({
      where: { userId: actorId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await this.audit("auth.logout_all", actorId, "User", actorId, null, meta);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return this.toPublicUser(user);
  }

  async listSessions(userId: string) {
    return this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true
      }
    });
  }

  async confirmEmail(dto: TokenDto, meta: RequestMeta) {
    const token = await this.consumeVerificationToken(dto.token, "EMAIL_CONFIRMATION");
    const user = await this.prisma.user.update({
      where: { id: token.userId },
      data: { emailConfirmedAt: new Date(), status: "ACTIVE" }
    });
    await this.audit("auth.confirm_email", user.id, "User", user.id, null, meta);
    return this.toPublicUser(user);
  }

  async forgotPassword(emailValue: string, meta: RequestMeta) {
    const email = this.normalizeEmail(emailValue);
    const user = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (!user) return { ok: true };

    const token = await this.createVerificationToken(user.id, "PASSWORD_RESET");
    await this.audit("auth.forgot_password", user.id, "User", user.id, null, meta);
    return {
      ok: true,
      resetToken: this.config.get("NODE_ENV") === "production" ? undefined : token
    };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta) {
    const token = await this.consumeVerificationToken(dto.token, "PASSWORD_RESET");
    const user = await this.prisma.user.update({
      where: { id: token.userId },
      data: {
        passwordHash: await this.hashPassword(dto.password),
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: "ACTIVE"
      }
    });

    await this.prisma.refreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await this.audit("auth.reset_password", user.id, "User", user.id, null, meta);
    return { ok: true };
  }

  verifyAccessToken(token: string): JwtPayload {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) {
      throw new UnauthorizedException("Invalid access token");
    }

    const expected = this.sign(`${encodedHeader}.${encodedPayload}`);
    if (!this.safeCompare(signature, expected)) {
      throw new UnauthorizedException("Invalid access token");
    }

    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as JwtPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("Access token expired");
    }
    return payload;
  }

  private async seedAdmin() {
    if (this.externalAuth.isEnabled()) return;

    const email = this.normalizeEmail(this.getRequiredConfig("ADMIN_EMAIL", "admin@docs.vn"));
    const password = this.getRequiredConfig("ADMIN_PASSWORD", "Admin@123456");
    const name = this.config.get<string>("ADMIN_NAME") ?? "System Admin";

    const existingAdmin = await this.prisma.user.findFirst({ where: { globalRole: "ADMIN", deletedAt: null } });
    if (existingAdmin) return;

    await this.prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        passwordHash: await this.hashPassword(password),
        globalRole: "ADMIN",
        status: "ACTIVE",
        emailConfirmedAt: new Date()
      },
      update: {
        name,
        globalRole: "ADMIN",
        status: "ACTIVE",
        emailConfirmedAt: new Date(),
        deletedAt: null
      }
    });
  }

  private async loginWithExternalProvider(email: string, password: string, meta: RequestMeta) {
    const externalSession = await this.externalAuth.login(email, password);
    const user = await this.syncExternalUser(externalSession.user);
    const refreshToken = await this.createRefreshSession(user, meta);

    await this.audit("auth.external_login_success", user.id, "User", user.id, {
      externalUserId: externalSession.user.externalUserId,
      externalRole: externalSession.user.externalRole,
      externalCompanyId: externalSession.user.externalCompanyId,
      externalDepartmentId: externalSession.user.externalDepartmentId
    }, meta);

    return {
      user: this.toPublicUser(user),
      accessToken: this.signAccessToken(user),
      refreshToken
    };
  }

  private async syncExternalUser(externalUser: {
    externalUserId: string;
    email: string;
    name: string;
    role: GlobalRole;
    externalRole: string;
    externalCompanyId: string | null;
    externalDepartmentId: string | null;
  }) {
    const email = this.normalizeEmail(externalUser.email);
    const existingUser = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { externalUserId: externalUser.externalUserId },
          { email }
        ]
      }
    });

    const data = {
      email,
      name: externalUser.name,
      globalRole: externalUser.role,
      externalUserId: externalUser.externalUserId,
      externalRole: externalUser.externalRole,
      externalCompanyId: externalUser.externalCompanyId,
      externalDepartmentId: externalUser.externalDepartmentId,
      status: "ACTIVE" as const,
      failedLoginAttempts: 0,
      lockedUntil: null,
      emailConfirmedAt: new Date(),
      deletedAt: null
    };

    if (existingUser) {
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data
      });
    }

    return this.prisma.user.create({
      data: {
        ...data,
        passwordHash: await this.hashPassword(randomBytes(32).toString("base64url"))
      }
    });
  }

  private async recordFailedLogin(user: User, meta: RequestMeta) {
    const failedLoginAttempts = user.failedLoginAttempts + 1;
    const shouldLock = failedLoginAttempts >= MAX_FAILED_LOGINS;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts,
        status: shouldLock ? "LOCKED" : user.status,
        lockedUntil: shouldLock ? this.minutesFromNow(LOCK_MINUTES) : user.lockedUntil
      }
    });
    await this.audit("auth.login_failed", user.id, "User", user.id, { failedLoginAttempts }, meta);
  }

  private assertCanLogin(user: User) {
    if (user.status === "DISABLED") {
      throw new ForbiddenException("Tài khoản đã bị vô hiệu hóa");
    }

    if (user.status === "LOCKED") {
      if (user.lockedUntil && user.lockedUntil <= new Date()) return;
      throw new ForbiddenException("Tài khoản đang bị khóa tạm thời");
    }
  }

  private async createRefreshSession(user: User, meta: RequestMeta) {
    const refreshToken = randomBytes(48).toString("base64url");
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: this.daysFromNow(REFRESH_TOKEN_TTL_DAYS)
      }
    });
    return refreshToken;
  }

  private signAccessToken(user: User) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.globalRole,
        externalRole: user.externalRole,
        externalCompanyId: user.externalCompanyId,
        externalDepartmentId: user.externalDepartmentId,
        exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS
      })
    ).toString("base64url");
    const body = `${header}.${payload}`;
    return `${body}.${this.sign(body)}`;
  }

  private sign(value: string) {
    return createHmac("sha256", this.getRequiredConfig("JWT_ACCESS_SECRET", "dev-only-access-secret"))
      .update(value)
      .digest("base64url");
  }

  private async createVerificationToken(userId: string, type: TokenType) {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hashToken(token),
        expiresAt: this.minutesFromNow(OTP_TTL_MINUTES)
      }
    });
    return token;
  }

  private async consumeVerificationToken(token: string, type: TokenType) {
    const tokenRecord = await this.prisma.verificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) }
    });

    if (!tokenRecord || tokenRecord.type !== type || tokenRecord.consumedAt || tokenRecord.expiresAt <= new Date()) {
      throw new BadRequestException("Token không hợp lệ hoặc đã hết hạn");
    }

    return this.prisma.verificationToken.update({
      where: { id: tokenRecord.id },
      data: { consumedAt: new Date() }
    });
  }

  private hashToken(token: string) {
    return createHmac("sha256", this.getRequiredConfig("JWT_REFRESH_SECRET", "dev-only-refresh-secret"))
      .update(token)
      .digest("hex");
  }

  private getRequiredConfig(key: string, developmentFallback: string) {
    const value = this.config.get<string>(key);
    if (value) return value;

    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new TypeError(`Configuration key "${key}" does not exist`);
    }

    return developmentFallback;
  }

  private safeCompare(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.globalRole,
      externalRole: user.externalRole,
      externalCompanyId: user.externalCompanyId,
      externalDepartmentId: user.externalDepartmentId,
      status: user.status,
      createdAt: user.createdAt
    };
  }

  private async audit(
    action: string,
    actorId: string | null,
    entityType: string | null,
    entityId: string | null,
    metadata: object | null,
    meta: RequestMeta
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        actorId,
        entityType,
        entityId,
        metadata: metadata ?? undefined,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
