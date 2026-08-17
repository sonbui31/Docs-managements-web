import { WorkboardColumnType } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateWorkboardColumnDto {
  @IsString()
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  color?: string;

  @IsOptional()
  @IsEnum(WorkboardColumnType)
  type?: WorkboardColumnType;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isDone?: boolean;
}
