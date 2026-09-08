import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { DocumentStatus } from "@prisma/client";

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;

  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  expectedVersion?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;
}
