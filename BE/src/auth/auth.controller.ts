import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { REFRESH_COOKIE_NAME, readCookie } from "./auth.cookies";
import { AuthService } from "./auth.service";
import { AuthenticatedUser } from "./auth.types";
import { CurrentUser } from "./current-user.decorator";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { TokenDto } from "./dto/token.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto, this.meta(request));
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto, this.meta(request));
    this.setRefreshCookie(response, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post("refresh")
  refresh(@Req() request: Request) {
    return this.authService.refresh(readCookie(request, REFRESH_COOKIE_NAME), this.meta(request));
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.logout(readCookie(request, REFRESH_COOKIE_NAME), undefined, this.meta(request));
    this.clearRefreshCookie(response);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Post("confirm-email")
  confirmEmail(@Body() dto: TokenDto, @Req() request: Request) {
    return this.authService.confirmEmail(dto, this.meta(request));
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto.email, this.meta(request));
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, this.meta(request));
  }

  private setRefreshCookie(response: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === "production";
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/api/v1/auth",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
  }

  private clearRefreshCookie(response: Response) {
    const isProduction = process.env.NODE_ENV === "production";
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/api/v1/auth"
    });
  }

  private meta(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]
    };
  }
}
