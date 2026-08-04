import { GlobalRole, UserStatus } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsEnum(GlobalRole)
  role?: GlobalRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
