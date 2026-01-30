import { IsString, MinLength } from "class-validator";

export class TwoFactorDto {
  @IsString()
  @MinLength(4)
  token!: string;
}
