import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ReceivePurchaseOrderDto {
  @IsInt()
  @Min(1)
  warehouseId: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
