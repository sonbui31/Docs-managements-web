import { IsString, MaxLength } from "class-validator";

export class UpdateWorkItemCommentDto {
  @IsString()
  @MaxLength(3000)
  content: string;
}
