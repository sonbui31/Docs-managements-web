import { ProjectRole } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AssignProjectDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectRole, { each: true })
  roles?: ProjectRole[];
}
