import { IsIn, IsOptional, IsString } from "class-validator";

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["b2b", "public", "b2c"])
  type?: "b2b" | "public" | "b2c";
}
