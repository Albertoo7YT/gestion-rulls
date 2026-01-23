import { IsArray, IsOptional, IsString } from "class-validator";

export class CatalogPdfDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skus?: string[];
}
