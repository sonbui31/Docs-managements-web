import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(40)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @IsString()
  htmlContent!: string;
}
