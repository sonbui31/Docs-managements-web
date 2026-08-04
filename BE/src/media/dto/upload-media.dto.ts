import { IsOptional, IsString } from "class-validator";

export class UploadMediaDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  documentId?: string;
}
