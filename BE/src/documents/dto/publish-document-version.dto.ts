import { IsOptional, IsString, MaxLength } from "class-validator";

export class PublishDocumentVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeNote?: string;
}
