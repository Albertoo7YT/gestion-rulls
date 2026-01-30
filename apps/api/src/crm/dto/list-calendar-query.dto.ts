import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Min } from "class-validator";

export class ListCalendarQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner?: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
