import { IsOptional, IsString, MaxLength } from "class-validator";

export class ImportDocumentDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  language?: string;
}
