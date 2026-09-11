import { BadRequestException } from "@nestjs/common";
import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

const MB = 1024 * 1024;

type UploadOptionsParams = {
  maxSizeMb: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
};

export const importUploadOptions = uploadOptions({
  maxSizeMb: 25,
  allowedExtensions: [".md", ".doc", ".docx", ".pdf"],
  allowedMimeTypes: [
    "text/markdown",
    "text/plain",
    "application/msword",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]
});

export const imageUploadOptions = uploadOptions({
  maxSizeMb: 10,
  allowedExtensions: [".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"],
  allowedMimeTypes: [
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/webp"
  ]
});

function uploadOptions(params: UploadOptionsParams): MulterOptions {
  const allowedExtensions = new Set(params.allowedExtensions.map((extension) => extension.toLowerCase()));
  const allowedMimeTypes = new Set(params.allowedMimeTypes.map((mimeType) => mimeType.toLowerCase()));

  return {
    limits: {
      fileSize: params.maxSizeMb * MB,
      files: 1
    },
    fileFilter: (_request, file, callback) => {
      const extension = extensionFromFileName(file.originalname);
      const mimeType = file.mimetype.toLowerCase();
      const isAllowed = allowedExtensions.has(extension) && allowedMimeTypes.has(mimeType);

      callback(isAllowed ? null : new BadRequestException("File type is unsupported"), isAllowed);
    }
  };
}

function extensionFromFileName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}
