import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { AuthenticatedUser } from "../auth/auth.types";
import { PermissionsService } from "../permissions/permissions.service";
import { PrismaService } from "../prisma/prisma.service";
import { UploadMediaDto } from "./dto/upload-media.dto";

@Injectable()
export class MediaService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService
  ) {
    cloudinary.config({
      cloud_name: this.config.get<string>("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.get<string>("CLOUDINARY_API_KEY"),
      api_secret: this.config.get<string>("CLOUDINARY_API_SECRET")
    });
  }

  async upload(file: Express.Multer.File | undefined, dto: UploadMediaDto, user: AuthenticatedUser) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    if (dto.documentId) {
      await this.permissions.assertDocumentRole(user, dto.documentId, ["REVIEWER", "EDITOR", "MANAGER"]);
    } else {
      await this.permissions.assertProjectRole(user, dto.projectId, ["REVIEWER", "EDITOR", "MANAGER"]);
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

  async findByProject(projectId: string, user: AuthenticatedUser) {
    await this.permissions.assertProjectRole(user, projectId, ["VIEWER"]);

    return this.prisma.mediaAsset.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" }
    });
  }

  async findByDocument(documentId: string, user: AuthenticatedUser) {
    await this.permissions.assertDocumentRole(user, documentId, ["VIEWER"]);

    return this.prisma.mediaAsset.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" }
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        documentId: true,
        cloudinaryPublicId: true
      }
    });

    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }

    if (asset.documentId) {
      await this.permissions.assertDocumentRole(user, asset.documentId, ["EDITOR", "MANAGER"]);
    } else {
      await this.permissions.assertProjectRole(user, asset.projectId, ["EDITOR", "MANAGER"]);
    }

    await cloudinary.uploader.destroy(asset.cloudinaryPublicId, { resource_type: "image" }).catch(() => undefined);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }
}
