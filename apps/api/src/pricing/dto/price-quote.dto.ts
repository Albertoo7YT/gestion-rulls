import { IsIn, IsString } from "class-validator";

export class PriceQuoteQueryDto {
  @IsString()
  sku: string;

  @IsIn(["B2B", "B2C"])
  channel: "B2B" | "B2C";
}
