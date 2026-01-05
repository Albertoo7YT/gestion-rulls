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

export class UpdatePriceRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(PriceRuleTarget)
  target?: PriceRuleTarget;

  @IsOptional()
  @IsEnum(PriceRuleScope)
  scope?: PriceRuleScope;

  @IsOptional()
  @IsEnum(PriceRuleType)
  type?: PriceRuleType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;

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
