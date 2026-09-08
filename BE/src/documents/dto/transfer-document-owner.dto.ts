import { IsString } from "class-validator";

export class TransferDocumentOwnerDto {
  @IsString()
  ownerId: string;
}
