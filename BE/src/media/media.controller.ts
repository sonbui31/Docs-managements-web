import { Body, Controller, Delete, Get, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { AuthenticatedUser } from "../auth/auth.types";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UploadMediaDto } from "./dto/upload-media.dto";
import { MediaService } from "./media.service";

@ApiTags("media")
@UseGuards(JwtAuthGuard)
@Controller({ path: "media", version: "1" })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadMediaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.upload(file, dto, user);
  }

  @Get("project/:projectId")
  findByProject(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.findByProject(projectId, user);
  }

  @Get("document/:documentId")
  findByDocument(@Param("documentId") documentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.findByDocument(documentId, user);
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.mediaService.remove(id, user);
  }
}
