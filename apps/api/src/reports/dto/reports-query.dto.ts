import { IsIn, IsOptional, IsString } from "class-validator";

export class ReportsQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsIn(["B2B", "B2C", "WEB"])
  channel?: "B2B" | "B2C" | "WEB";

  @IsOptional()
  @IsString()
  seriesScope?: string;

  @IsOptional()
  @IsString()
  seriesCode?: string;
}
