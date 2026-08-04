import { ProjectRole } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class AssignProjectDto {
  @IsString()
  projectId: string;

  @IsEnum(ProjectRole)
  role: ProjectRole;
}
