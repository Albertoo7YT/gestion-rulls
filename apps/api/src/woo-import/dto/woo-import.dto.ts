import { IsBoolean, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { IsInt } from "class-validator";

export class WooImportDto {
  @IsOptional()
  @IsBoolean()
  includePending?: boolean;

  @IsOptional()
  @IsBoolean()
  importOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  importProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  importImages?: boolean;

  @IsOptional()
  @IsBoolean()
  importPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  importCategories?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  importWarehouseId?: number;
}
