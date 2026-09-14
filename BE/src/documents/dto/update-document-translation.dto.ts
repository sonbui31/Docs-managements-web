import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateDocumentTranslationDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceVersion?: string;

  @IsOptional()
  @IsIn(["DRAFT", "READY", "OUTDATED"])
  status?: string;
}
