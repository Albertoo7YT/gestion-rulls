import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class StockQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  locationId: number;
}
