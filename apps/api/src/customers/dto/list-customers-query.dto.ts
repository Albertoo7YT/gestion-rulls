import { IsIn, IsOptional, IsString } from "class-validator";

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["b2b", "public"])
  type?: "b2b" | "public";
}
