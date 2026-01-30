import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ListBoardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  owner?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  phase?: number;

  @IsOptional()
  @IsString()
  q?: string;
}
