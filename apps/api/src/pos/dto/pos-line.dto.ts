import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

export class PosAddOnDto {
  @IsInt()
  @Min(1)
  accessoryId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class PosLineDto {
  @IsString()
  @MinLength(1)
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsArray()
  @Type(() => PosAddOnDto)
  addOns?: PosAddOnDto[];
}
