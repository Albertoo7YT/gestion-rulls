import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PosLineDto } from "../../pos/dto/pos-line.dto";

export class CreateOrderDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warehouseId: number;

  @IsOptional()
  @IsIn(["B2B", "B2C"])
  channel?: "B2B" | "B2C";

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  giftSale?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PosLineDto)
  lines: PosLineDto[];
}
