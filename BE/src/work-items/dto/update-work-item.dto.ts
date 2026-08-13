import { WorkItemPriority, WorkItemStatus, WorkItemType } from "@prisma/client";
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { WorkItemAttachmentDto } from "./create-work-item.dto";

export class UpdateWorkItemDto {
  @IsOptional()
  @IsString()
  documentId?: string | null;

  @IsOptional()
  @IsString()
  sourceCommentId?: string | null;

  @IsOptional()
  @IsEnum(WorkItemType)
  type?: WorkItemType;

  @IsOptional()
  @IsEnum(WorkItemStatus)
  status?: WorkItemStatus;

  @IsOptional()
  @IsEnum(WorkItemPriority)
  priority?: WorkItemPriority;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkItemAttachmentDto)
  attachments?: WorkItemAttachmentDto[] | null;

  @IsOptional()
  @IsString()
  assigneeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeName?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
