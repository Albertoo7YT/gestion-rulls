import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ArrayNotEmpty,
  ValidateNested,
} from "class-validator";
import { PosLineDto } from "./pos-line.dto";

export class PosSaleDto {
  @IsInt()
  @Min(1)
  warehouseId: number;

  @IsIn(["B2B", "B2C"])
  channel: "B2B" | "B2C";

  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

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
  @IsIn(["pending", "partial", "paid"])
  paymentStatus?: "pending" | "partial" | "paid";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paidAmount?: number;

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
