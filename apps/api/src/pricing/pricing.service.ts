import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  PriceRuleScope,
  PriceRuleTarget,
  PriceRuleType,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePriceRuleDto } from "./dto/create-price-rule.dto";
import { UpdatePriceRuleDto } from "./dto/update-price-rule.dto";

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  listRules() {
    return this.prisma.priceRule.findMany({
      orderBy: [{ active: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async createRule(dto: CreatePriceRuleDto) {
    this.validateScope(dto.scope, dto.categoryId, dto.supplierId);
    return this.prisma.priceRule.create({
      data: {
        name: dto.name.trim(),
        target: dto.target,
        scope: dto.scope,
        type: dto.type,
        value: dto.value,
        priority: dto.priority ?? 100,
        active: dto.active ?? true,
        categoryId: dto.categoryId ?? undefined,
        supplierId: dto.supplierId ?? undefined,
      },
    });
  }

  async updateRule(id: number, dto: UpdatePriceRuleDto) {
    const existing = await this.prisma.priceRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Rule not found");
    }
    this.validateScope(
      dto.scope ?? existing.scope,
      dto.categoryId ?? existing.categoryId ?? undefined,
      dto.supplierId ?? existing.supplierId ?? undefined,
    );
    return this.prisma.priceRule.update({
      where: { id },
      data: {
        name: dto.name?.trim() ?? undefined,
        target: dto.target ?? undefined,
        scope: dto.scope ?? undefined,
        type: dto.type ?? undefined,
        value: dto.value ?? undefined,
        priority: dto.priority ?? undefined,
        active: dto.active ?? undefined,
        categoryId: dto.categoryId ?? undefined,
        supplierId: dto.supplierId ?? undefined,
      },
    });
  }

  removeRule(id: number) {
    return this.prisma.priceRule.delete({ where: { id } });
  }

  async quote(sku: string, channel: "B2B" | "B2C") {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { categories: true },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }

    const target =
      channel === "B2B" ? PriceRuleTarget.b2b : PriceRuleTarget.public;
    const base =
      target === PriceRuleTarget.b2b ? product.b2bPrice : product.rrp;

    if (base === null || base === undefined) {
      return { sku, channel, base: null, price: null, rule: null };
    }

    const rules = await this.prisma.priceRule.findMany({
      where: { active: true, target },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });

    const categoryIds = product.categories.map((c) => c.categoryId);
    const rule = rules.find((r) => {
      if (r.scope === PriceRuleScope.all) return true;
      if (r.scope === PriceRuleScope.category && r.categoryId) {
        return categoryIds.includes(r.categoryId);
      }
      if (r.scope === PriceRuleScope.supplier && r.supplierId) {
        return r.supplierId === product.supplierId;
      }
      return false;
    });

    const baseNumber = Number(base);
    const price = rule
      ? rule.type === PriceRuleType.percent
        ? Math.max(baseNumber - baseNumber * (Number(rule.value) / 100), 0)
        : Number(rule.value)
      : baseNumber;

    return {
      sku,
      channel,
      base: baseNumber,
      price,
      rule: rule
        ? {
            id: rule.id,
            name: rule.name,
            type: rule.type,
            value: Number(rule.value),
          }
        : null,
    };
  }

  private validateScope(
    scope: PriceRuleScope,
    categoryId?: number,
    supplierId?: number,
  ) {
    if (scope === PriceRuleScope.category && !categoryId) {
      throw new BadRequestException("categoryId is required for category scope");
    }
    if (scope === PriceRuleScope.supplier && !supplierId) {
      throw new BadRequestException("supplierId is required for supplier scope");
    }
  }
}
