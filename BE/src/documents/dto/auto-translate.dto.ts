import { IsOptional, IsString } from "class-validator";

export class AutoTranslateDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  htmlContent?: string;

  @IsOptional()
  @IsString()
  fromLang?: string;

  @IsOptional()
  @IsString()
  toLang?: string;
}
