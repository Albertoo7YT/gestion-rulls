import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class CreateCustomerDto {
  @IsIn(["b2b", "public"])
  type: "b2b" | "public";

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
