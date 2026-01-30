import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class MoveBoardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  toStatusId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toPhaseId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
