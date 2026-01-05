import { IsArray, IsInt, IsOptional } from "class-validator";
import { Type } from "class-transformer";

export class WooExportStockDto {
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  warehouseIds?: number[];
}
