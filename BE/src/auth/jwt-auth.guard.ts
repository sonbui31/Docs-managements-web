import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: unknown }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : undefined;

    if (!token) {
      throw new UnauthorizedException("Missing access token");
    }

    const payload = this.authService.verifyAccessToken(token);
    request.user = {
      id: payload.sub,
      email: payload.email,
      name: "",
      role: payload.role,
      externalRole: payload.externalRole,
      externalCompanyId: payload.externalCompanyId,
      externalDepartmentId: payload.externalDepartmentId,
      externalAccessToken: payload.externalAccessToken,
      status: "ACTIVE"
    };
    return true;
  }
}
