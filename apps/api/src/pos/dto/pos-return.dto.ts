import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PosReturnLineDto } from "./pos-return-line.dto";

export class PosReturnDto {
  @IsInt()
  @Min(1)
  saleId: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PosReturnLineDto)
  lines: PosReturnLineDto[];
}
