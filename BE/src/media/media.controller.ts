import { Body, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { UploadMediaDto } from "./dto/upload-media.dto";
import { MediaService } from "./media.service";

@ApiTags("media")
@Controller({ path: "media", version: "1" })
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post("upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadMediaDto) {
    return this.mediaService.upload(file, dto);
  }
}
