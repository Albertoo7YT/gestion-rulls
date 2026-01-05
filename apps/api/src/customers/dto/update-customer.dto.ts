import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateCustomerDto {
  @IsOptional()
  @IsIn(["b2b", "public"])
  type?: "b2b" | "public";

  @IsOptional()
  @IsString()
  name?: string;

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
