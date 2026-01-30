import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class DepositLineDto {
  @IsString()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class DepositSaleLineDto extends DepositLineDto {
  @IsNumber()
  unitPrice: number;
}

export class CreateDepositSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepositSaleLineDto)
  lines: DepositSaleLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateDepositReturnDto {
  @IsInt()
  @Min(1)
  warehouseId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepositLineDto)
  lines: DepositLineDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
