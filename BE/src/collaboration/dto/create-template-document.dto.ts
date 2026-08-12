import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTemplateDocumentDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  type?: string;
}
