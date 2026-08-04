import { Controller, Get, Header, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ExportsService } from "./exports.service";

@ApiTags("exports")
@Controller({ path: "exports", version: "1" })
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get("documents/:id/pdf")
  @Header("Content-Type", "application/pdf")
  exportPdf(@Param("id") id: string) {
    return this.exportsService.exportPdf(id);
  }

  @Get("documents/:id/docx")
  @Header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  exportDocx(@Param("id") id: string) {
    return this.exportsService.exportDocx(id);
  }
}
