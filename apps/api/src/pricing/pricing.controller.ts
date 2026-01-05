import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/roles.decorator";
import { CreatePriceRuleDto } from "./dto/create-price-rule.dto";
import { PriceQuoteQueryDto } from "./dto/price-quote.dto";
import { UpdatePriceRuleDto } from "./dto/update-price-rule.dto";
import { PricingService } from "./pricing.service";

@Controller("pricing")
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get("rules")
  @Roles(UserRole.admin)
  listRules() {
    return this.pricing.listRules();
  }

  @Post("rules")
  @Roles(UserRole.admin)
  createRule(@Body() dto: CreatePriceRuleDto) {
    return this.pricing.createRule(dto);
  }

  @Put("rules/:id")
  @Roles(UserRole.admin)
  updateRule(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePriceRuleDto,
  ) {
    return this.pricing.updateRule(id, dto);
  }

  @Delete("rules/:id")
  @Roles(UserRole.admin)
  removeRule(@Param("id", ParseIntPipe) id: number) {
    return this.pricing.removeRule(id);
  }

  @Get("quote")
  quote(@Query() query: PriceQuoteQueryDto) {
    return this.pricing.quote(query.sku, query.channel);
  }
}
