import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ExportsService } from "./exports.service";

@ApiTags("exports")
@UseGuards(JwtAuthGuard)
@Controller({ path: "exports", version: "1" })
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get("documents/:id/pdf")
  async exportPdf(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const result = await this.exportsService.exportPdf(id, user);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return response.send(result.buffer);
  }

  @Get("documents/:id/docx")
  async exportDocx(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const result = await this.exportsService.exportDocx(id, user);
    response.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return response.send(result.buffer);
  }

  @Get("projects/:id/work-items.csv")
  async exportProjectWorkItemsCsv(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const result = await this.exportsService.exportProjectWorkItemsCsv(id, user);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return response.send(result.buffer);
  }

  @Get("projects/:id/activity.csv")
  async exportProjectActivityCsv(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response
  ) {
    const result = await this.exportsService.exportProjectActivityCsv(id, user);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    return response.send(result.buffer);
  }
}
