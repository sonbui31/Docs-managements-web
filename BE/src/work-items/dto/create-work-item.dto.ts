import { WorkItemPriority, WorkItemStatus, WorkItemType } from "@prisma/client";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class WorkItemAttachmentDto {
  @IsString()
  @MaxLength(1000)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  mimeType?: string;
}

export class CreateWorkItemDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsString()
  sourceCommentId?: string;

  @IsOptional()
  @IsEnum(WorkItemType)
  type?: WorkItemType;

  @IsOptional()
  @IsEnum(WorkItemStatus)
  status?: WorkItemStatus;

  @IsOptional()
  @IsEnum(WorkItemPriority)
  priority?: WorkItemPriority;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkItemAttachmentDto)
  attachments?: WorkItemAttachmentDto[];

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
