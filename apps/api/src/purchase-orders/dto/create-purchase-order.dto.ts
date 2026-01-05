import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { PurchaseOrderLineDto } from "./purchase-order-line.dto";

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsString()
  number?: string;

  @IsInt()
  @Min(1)
  supplierId: number;

  @IsOptional()
  @IsIn(["draft", "ordered", "cancelled"])
  status?: "draft" | "ordered" | "cancelled";

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineDto)
  lines: PurchaseOrderLineDto[];
}
