import { IsArray, IsString } from "class-validator";

export class ReorderWorkboardColumnsDto {
  @IsArray()
  @IsString({ each: true })
  columnIds: string[];
}
