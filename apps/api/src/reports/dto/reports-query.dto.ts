import { IsIn, IsOptional, IsString } from "class-validator";

export class ReportsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(["B2B", "B2C"])
  channel?: "B2B" | "B2C";
}
