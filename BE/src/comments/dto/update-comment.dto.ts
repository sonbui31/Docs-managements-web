import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  selectedText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  blockId?: string;
}
