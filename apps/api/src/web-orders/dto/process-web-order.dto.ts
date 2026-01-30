import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";

class ProcessWebOrderAddOnDto {
  @IsInt()
  @Min(1)
  accessoryId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class ProcessWebOrderDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProcessWebOrderAddOnDto)
  addOns?: ProcessWebOrderAddOnDto[];
}
