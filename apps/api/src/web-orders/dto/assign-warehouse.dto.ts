import { IsInt, Min } from "class-validator";

export class AssignWarehouseDto {
  @IsInt()
  @Min(1)
  warehouseId: number;
}
