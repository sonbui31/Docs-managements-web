import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTraceLinkDto {
  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsOptional()
  @IsString()
  targetDocumentId?: string;

  @IsString()
  @MaxLength(64)
  sourceCode!: string;

  @IsString()
  @MaxLength(240)
  sourceLabel!: string;

  @IsString()
  @MaxLength(64)
  targetCode!: string;

  @IsString()
  @MaxLength(240)
  targetLabel!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  relation?: string;
}
