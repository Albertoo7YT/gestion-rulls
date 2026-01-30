import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PosReturnDto } from "./dto/pos-return.dto";
import { PosSaleDto } from "./dto/pos-sale.dto";
import { SeriesService } from "../common/series.service";

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly seriesService: SeriesService,
  ) {}

  async createSale(dto: PosSaleDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      if (!dto.lines?.length) {
        throw new BadRequestException("At least one line is required");
      }

      const warehouse = await tx.location.findFirst({
        where: { id: dto.warehouseId, active: true, type: "warehouse" },
      });
      if (!warehouse) {
        throw new BadRequestException("warehouseId must be an active warehouse");
      }

      if (dto.channel === "B2B" && !dto.customerId) {
        throw new BadRequestException("customerId is required for B2B sales");
      }

      if (dto.channel === "B2B" && dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, active: true },
        });
        if (!customer) {
          throw new NotFoundException("Customer not found");
        }
        if (customer.type !== "b2b") {
          throw new BadRequestException("Customer must be B2B");
        }
      }

      if (dto.channel === "B2C" && dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, active: true },
        });
        if (!customer) {
          throw new NotFoundException("Customer not found");
        }
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));
      const productCosts = await tx.product.findMany({
        where: { sku: { in: dto.lines.map((line) => line.sku) } },
        select: { sku: true, engravingCost: true },
      });
      const productCostMap = new Map(
        productCosts.map((item) => [item.sku, item.engravingCost ?? 0]),
      );
      const accessoryIds = Array.from(
        new Set(
          dto.lines
            .flatMap((line) => line.addOns ?? [])
            .map((addOn) => addOn.accessoryId),
        ),
      );
      const accessories = accessoryIds.length
        ? await tx.accessory.findMany({ where: { id: { in: accessoryIds } } })
        : [];
      if (accessoryIds.length && accessories.length !== accessoryIds.length) {
        throw new BadRequestException("Some accessories do not exist");
      }
      const accessoryMap = new Map(accessories.map((a) => [a.id, a]));
      if (!dto.allowNegativeStock) {
        await this.ensureNoNegativeStock(tx, dto.warehouseId, dto.lines);
      }

      const isGift = dto.giftSale === true;
      const saleTotal = dto.lines.reduce((sum, line) => {
        const unitPrice = isGift ? 0 : Number(line.unitPrice ?? 0);
        const addOnTotal = (line.addOns ?? []).reduce((addSum, addOn) => {
          const qty = Number(addOn.quantity ?? 1);
          const price = isGift ? 0 : Number(addOn.price ?? 0);
          return addSum + price * qty;
        }, 0);
        return sum + unitPrice * line.quantity + addOnTotal;
      }, 0);

      let paymentStatus = dto.paymentStatus;
      let paidAmount = dto.paidAmount;
      if (!paymentStatus) {
        paymentStatus = dto.channel === "B2B" ? "pending" : "paid";
      }
      if (paymentStatus === "paid") {
        paidAmount = saleTotal;
      } else if (paymentStatus === "pending") {
        paidAmount = 0;
      } else if (paymentStatus === "partial") {
        if (paidAmount == null) {
          throw new BadRequestException("paidAmount is required for partial payment");
        }
        if (paidAmount <= 0 || paidAmount >= saleTotal) {
          throw new BadRequestException("paidAmount must be between 0 and total");
        }
      }
      if (paidAmount != null && paidAmount >= saleTotal) {
        paymentStatus = "paid";
        paidAmount = saleTotal;
      }

      const notesParts: string[] = [];
      if (isGift) notesParts.push("REGALO");
      if (dto.paymentMethod) notesParts.push(dto.paymentMethod);
      if (dto.notes) notesParts.push(dto.notes);

      let reference = dto.reference?.trim();
      let seriesMeta: {
        reference: string;
        seriesCode: string;
        seriesYear: number | null;
        seriesNumber: number;
      } | null = null;
      const resolvedDate = this.resolveMoveDate(dto.date);
      if (!reference) {
        const scope = dto.channel === "B2B" ? "sale_b2b" : "sale_b2c";
        seriesMeta = await this.seriesService.allocate(
          tx,
          scope,
          resolvedDate ?? new Date(),
        );
        reference = seriesMeta.reference;
      }

      const created = await tx.stockMove.create({
        data: {
          type: dto.channel === "B2B" ? StockMoveType.b2b_sale : StockMoveType.b2c_sale,
          channel: dto.channel === "B2B" ? StockMoveChannel.B2B : StockMoveChannel.B2C,
          fromId: dto.warehouseId,
          toId: null,
          customerId: dto.customerId,
          reference,
          seriesCode: seriesMeta?.seriesCode,
          seriesYear: seriesMeta?.seriesYear ?? undefined,
          seriesNumber: seriesMeta?.seriesNumber,
          notes: notesParts.length ? notesParts.join(" | ") : undefined,
          date: resolvedDate ?? undefined,
          paymentStatus: paymentStatus ?? "paid",
          paidAmount: paidAmount ?? 0,
          lines: {
            create: dto.lines.map((line) => {
              const addOns = (line.addOns ?? []).map((addOn) => {
                const accessory = accessoryMap.get(addOn.accessoryId);
                const quantity = addOn.quantity ?? 1;
                return {
                  id: addOn.accessoryId,
                  name: accessory?.name ?? "",
                  quantity,
                  cost: accessory?.cost ?? 0,
                  price: isGift ? 0 : addOn.price ?? 0,
                };
              });
              const addOnCost = addOns.reduce(
                (sum, item) =>
                  sum + Number(item.cost ?? 0) * Number(item.quantity ?? 1),
                0,
              );
              const engravingCost = Number(productCostMap.get(line.sku) ?? 0);
              const addOnPrice = addOns.reduce(
                (sum, item) =>
                  sum + Number(item.price ?? 0) * Number(item.quantity ?? 1),
                0,
              );
              return {
                sku: line.sku,
                quantity: line.quantity,
                unitPrice: isGift ? 0 : line.unitPrice,
                addOnCost: addOnCost + engravingCost || undefined,
                addOnPrice: addOnPrice || undefined,
                addOns: addOns.length ? addOns : undefined,
              };
            }),
          },
        },
        include: { lines: true },
      });

      await this.auditService.log({
        userId,
        method: "POST",
        path: "/pos/sale",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: created.type,
          fromId: created.fromId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  private resolveMoveDate(dateValue?: string) {
    if (!dateValue) return undefined;
    const hasTime = dateValue.includes("T");
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return undefined;
    if (!hasTime) {
      const now = new Date();
      parsed.setHours(
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds(),
      );
    }
    return parsed;
  }

  async createReturn(dto: PosReturnDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      if (!dto.lines?.length) {
        throw new BadRequestException("At least one line is required");
      }

      const sale = await tx.stockMove.findUnique({
        where: { id: dto.saleId },
        include: { lines: true },
      });

      if (
        !sale ||
        (sale.type !== StockMoveType.b2b_sale &&
          sale.type !== StockMoveType.b2c_sale)
      ) {
        throw new BadRequestException("saleId must be a valid sale move");
      }

      if (!sale.fromId) {
        throw new BadRequestException("Sale does not have a warehouse");
      }

      const targetWarehouseId = dto.warehouseId ?? sale.fromId;
      if (!targetWarehouseId) {
        throw new BadRequestException("warehouseId is required");
      }
      const warehouse = await tx.location.findFirst({
        where: { id: targetWarehouseId, active: true, type: "warehouse" },
      });
      if (!warehouse) {
        throw new BadRequestException("warehouseId must be an active warehouse");
      }

      const saleTotals = new Map<
        string,
        { quantity: number; unitPrice: Prisma.Decimal | null }
      >();
      for (const line of sale.lines) {
        const current = saleTotals.get(line.sku);
        if (current) {
          current.quantity += line.quantity;
        } else {
          saleTotals.set(line.sku, {
            quantity: line.quantity,
            unitPrice: line.unitPrice ?? null,
          });
        }
      }

      const returnedLines = await tx.stockMoveLine.findMany({
        where: {
          move: {
            relatedMoveId: sale.id,
            type: {
              in: [StockMoveType.b2b_return, StockMoveType.b2c_return],
            },
          },
        },
        select: { sku: true, quantity: true },
      });

      const returnedTotals = new Map<string, number>();
      for (const line of returnedLines) {
        returnedTotals.set(
          line.sku,
          (returnedTotals.get(line.sku) ?? 0) + line.quantity,
        );
      }

      const linesToReturn = dto.lines.filter((line) => line.quantity > 0);
      if (!linesToReturn.length) {
        throw new BadRequestException("At least one return line is required");
      }

      for (const line of linesToReturn) {
        const saleLine = saleTotals.get(line.sku);
        if (!saleLine) {
          throw new BadRequestException(`SKU ${line.sku} not in sale`);
        }
        const returned = returnedTotals.get(line.sku) ?? 0;
        const remaining = saleLine.quantity - returned;
        if (line.quantity > remaining) {
          throw new BadRequestException(
            `Return quantity for ${line.sku} exceeds remaining ${remaining}`,
          );
        }
      }

      const returnType =
        sale.type === StockMoveType.b2b_sale
          ? StockMoveType.b2b_return
          : StockMoveType.b2c_return;

      let seriesData:
        | { reference: string; seriesCode: string; seriesYear: number | null; seriesNumber: number }
        | null = null;
      if (!dto.reference) {
        seriesData = await this.seriesService.allocate(
          tx,
          "return",
          dto.date ? new Date(dto.date) : new Date(),
        );
      }

      const created = await tx.stockMove.create({
        data: {
          type: returnType,
          channel: sale.channel,
          toId: targetWarehouseId,
          customerId: sale.customerId ?? undefined,
          relatedMoveId: sale.id,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference ?? seriesData?.reference,
          seriesCode: seriesData?.seriesCode,
          seriesYear: seriesData?.seriesYear ?? undefined,
          seriesNumber: seriesData?.seriesNumber,
          notes: dto.notes,
          lines: {
            create: linesToReturn.map((line) => ({
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: saleTotals.get(line.sku)?.unitPrice ?? null,
            })),
          },
        },
        include: { lines: true },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/pos/return",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: created.type,
          toId: created.toId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  private async ensureProductsExist(
    tx: Prisma.TransactionClient,
    skus: string[],
  ) {
    const uniqueSkus = Array.from(new Set(skus));
    const products = await tx.product.findMany({
      where: { sku: { in: uniqueSkus } },
      select: { sku: true },
    });
    if (products.length !== uniqueSkus.length) {
      throw new BadRequestException("Some SKUs do not exist");
    }
  }

  private async ensureNoNegativeStock(
    tx: Prisma.TransactionClient,
    locationId: number,
    lines: { sku: string; quantity: number }[],
  ) {
    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.quantity);
    }

    for (const [sku, totalQty] of totals.entries()) {
      const available = await this.getStockForSku(tx, locationId, sku);
      if (available - totalQty < 0) {
        throw new BadRequestException(
          `Insufficient stock for ${sku} at location ${locationId}`,
        );
      }
    }
  }

  private async getStockForSku(
    tx: Prisma.TransactionClient,
    locationId: number,
    sku: string,
  ) {
    const incoming = await tx.stockMoveLine.aggregate({
      _sum: { quantity: true },
      where: { sku, move: { toId: locationId } },
    });
    const outgoing = await tx.stockMoveLine.aggregate({
      _sum: { quantity: true },
      where: { sku, move: { fromId: locationId } },
    });
    return (incoming._sum.quantity ?? 0) - (outgoing._sum.quantity ?? 0);
  }
}
