import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min, IsDateString } from "class-validator";

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner?: number;

  @IsOptional()
  @IsIn(["pending", "done"])
  status?: "pending" | "done";

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
