import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { MoveLineDto } from "./move-line.dto";

export class B2bSaleMoveDto {
  @IsInt()
  @Min(1)
  fromId: number;

  @IsInt()
  @Min(1)
  toId: number;

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
