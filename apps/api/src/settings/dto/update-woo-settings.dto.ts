import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

export class UpdateWooSettingsDto {
  @IsOptional()
  @IsBoolean()
  wooSyncEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  wooStockWarehouseIds?: number[];

  @IsOptional()
  @IsDateString()
  lastWooSyncAt?: string;

  @IsOptional()
  @IsString()
  wooBaseUrl?: string;

  @IsOptional()
  @IsString()
  wooConsumerKey?: string;

  @IsOptional()
  @IsString()
  wooConsumerSecret?: string;

  @IsOptional()
  @IsBoolean()
  wooSyncProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  wooSyncImages?: boolean;
}
