import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateDocumentDto {
  @IsString()
  projectId: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  @MaxLength(40)
  type: string;

  @IsString()
  htmlContent: string;

  @IsOptional()
  @IsIn(["manual", "template", "imported"])
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceFileName?: string;
}
