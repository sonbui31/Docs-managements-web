import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ImportDocumentDto } from "./dto/import-document.dto";
import { ImportsService } from "./imports.service";

@ApiTags("imports")
@UseGuards(JwtAuthGuard)
@Controller({ path: "imports", version: "1" })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post("documents")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  importDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportDocumentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.importsService.importDocument(file, dto, user);
  }
}
