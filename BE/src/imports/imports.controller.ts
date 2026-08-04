import { Body, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ImportDocumentDto } from "./dto/import-document.dto";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@Controller({ path: "imports", version: "1" })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("documents")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  importDocument(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportDocumentDto) {
    return this.importsService.importDocument(file, dto);
  }
}
