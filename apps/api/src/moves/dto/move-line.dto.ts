import { IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class MoveLineDto {
  @IsString()
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;
}
