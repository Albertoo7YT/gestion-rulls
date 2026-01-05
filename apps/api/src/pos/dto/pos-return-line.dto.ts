import { IsInt, IsString, Min, MinLength } from "class-validator";

export class PosReturnLineDto {
  @IsString()
  @MinLength(1)
  sku: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
