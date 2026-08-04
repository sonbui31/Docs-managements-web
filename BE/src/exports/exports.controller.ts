import { Controller, Get, Header, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
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
  @Header("Content-Type", "application/pdf")
  exportPdf(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exportsService.exportPdf(id, user);
  }

  @Get("documents/:id/docx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  exportDocx(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.exportsService.exportDocx(id, user);
  }
}
