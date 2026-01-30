import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateDocumentSeriesDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  scope: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nextNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  padding?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDocumentSeriesDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  year?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nextNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  padding?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
