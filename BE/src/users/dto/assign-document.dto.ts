import { ProjectRole } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString } from "class-validator";

export class AssignDocumentDto {
  @IsString()
  documentId: string;

  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;

  @IsOptional()
  @IsArray()
  @IsEnum(ProjectRole, { each: true })
  roles?: ProjectRole[];
}
