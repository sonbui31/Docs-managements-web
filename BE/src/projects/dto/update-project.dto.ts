import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  client?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
