import { IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";

export class PurchaseOrderLineDto {
  @IsString()
  @MinLength(1)
  sku: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsString()
  manufacturerRef?: string;

  @IsOptional()
  @IsIn(["standard", "quick"])
  productType?: "standard" | "quick";

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;
}
