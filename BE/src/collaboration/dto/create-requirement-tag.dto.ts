import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateRequirementTagDto {
  @IsString()
  @MaxLength(64)
  code!: string;

  @IsIn(["BRQ", "FR", "REQ", "API", "RULE", "FLOW", "TEST", "NOTE"])
  kind!: string;

  @IsString()
  @MaxLength(240)
  label!: string;

  @IsOptional()
  @IsString()
  selectedText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  selector?: string;
}
