import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWorkItemCommentDto {
  @IsOptional()
  @IsString()
  parentId?: string;

  @IsString()
  @MaxLength(3000)
  content: string;
}
