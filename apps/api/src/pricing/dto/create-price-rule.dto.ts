import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { PriceRuleScope, PriceRuleTarget, PriceRuleType } from "@prisma/client";

export class CreatePriceRuleDto {
  @IsString()
  name: string;

  @IsEnum(PriceRuleTarget)
  target: PriceRuleTarget;

  @IsEnum(PriceRuleScope)
  scope: PriceRuleScope;

  @IsEnum(PriceRuleType)
  type: PriceRuleType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @IsInt()
  supplierId?: number;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
