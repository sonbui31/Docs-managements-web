import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDocumentTranslationDto {
  @IsString()
  @MaxLength(12)
  language: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  htmlContent: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sourceVersion?: string;

  @IsOptional()
  @IsIn(["DRAFT", "READY", "OUTDATED"])
  status?: string;
}
