import { ProjectRole } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AssignProjectsBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  projectIds: string[];

  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectRole, { each: true })
  roles?: ProjectRole[];
}
