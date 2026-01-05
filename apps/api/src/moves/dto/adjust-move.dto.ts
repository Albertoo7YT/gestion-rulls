import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  IsIn,
} from "class-validator";
import { MoveLineDto } from "./move-line.dto";

export class AdjustMoveDto {
  @IsInt()
  @Min(1)
  locationId: number;

  @IsIn(["in", "out"])
  direction: "in" | "out";

  @IsOptional()
  @IsBoolean()
  allowNegativeAdjust?: boolean;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MoveLineDto)
  lines: MoveLineDto[];
}
