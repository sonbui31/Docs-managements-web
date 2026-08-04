import { ProjectRole } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class AssignDocumentDto {
  @IsString()
  documentId: string;

  @IsEnum(ProjectRole)
  role: ProjectRole;
}
