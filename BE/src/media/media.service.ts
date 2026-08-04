import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { PrismaService } from "../prisma/prisma.service";
import { UploadMediaDto } from "./dto/upload-media.dto";

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {
    cloudinary.config({
      cloud_name: this.config.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.get<string>("CLOUDINARY_API_SECRET")
    });
  }

  async upload(file: Express.Multer.File | undefined, dto: UploadMediaDto) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const result = await new Promise<{
      public_id: string;
      secure_url: string;
      bytes: number;
      width?: number;
      height?: number;
      resource_type: string;
      format: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `ba-doc-control/${dto.projectId}`,
          resource_type: "auto"
        },
        (error, uploadResult) => {
          if (error || !uploadResult) {
            reject(error ?? new Error("Cloudinary upload failed"));
            return;
          }
          resolve(uploadResult);
        }
      );
      stream.end(file.buffer);
    });

    return this.prisma.mediaAsset.create({
      data: {
        projectId: dto.projectId,
        documentId: dto.documentId,
        cloudinaryPublicId: result.public_id,
        url: result.secure_url,
        mimeType: file.mimetype,
        size: result.bytes,
        width: result.width,
        height: result.height
      }
    });
  }
}
