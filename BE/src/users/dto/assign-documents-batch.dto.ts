import { ProjectRole } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AssignDocumentsBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  documentIds: string[];

  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectRole, { each: true })
  roles?: ProjectRole[];
}
