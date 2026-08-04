import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommentDto {
  @IsString()
  documentId: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @MaxLength(80)
  blockId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedText?: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  createdBy?: string;
}
