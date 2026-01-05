import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PosReturnDto } from "./dto/pos-return.dto";
import { PosSaleDto } from "./dto/pos-sale.dto";

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async createSale(dto: PosSaleDto) {
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
      if (!dto.allowNegativeStock) {
        await this.ensureNoNegativeStock(tx, dto.warehouseId, dto.lines);
      }

      const isGift = dto.giftSale === true;
      const notesParts: string[] = [];
      if (isGift) notesParts.push("REGALO");
      if (dto.paymentMethod) notesParts.push(dto.paymentMethod);
      if (dto.notes) notesParts.push(dto.notes);

      const created = await tx.stockMove.create({
        data: {
          type: dto.channel === "B2B" ? StockMoveType.b2b_sale : StockMoveType.b2c_sale,
          channel: dto.channel === "B2B" ? StockMoveChannel.B2B : StockMoveChannel.B2C,
          fromId: dto.warehouseId,
          toId: null,
          customerId: dto.customerId,
          reference: dto.reference,
          notes: notesParts.length ? notesParts.join(" | ") : undefined,
          date: dto.date ? new Date(dto.date) : undefined,
          lines: {
            create: dto.lines.map((line) => ({
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: isGift ? 0 : line.unitPrice,
            })),
          },
        },
        include: { lines: true },
      });

      if (!dto.reference?.trim()) {
        const orderNumber = `POS-${String(created.id).padStart(6, "0")}`;
        return tx.stockMove.update({
          where: { id: created.id },
          data: { reference: orderNumber },
          include: { lines: true },
        });
      }

      return created;
    });
  }

  async createReturn(dto: PosReturnDto) {
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

      const warehouse = await tx.location.findFirst({
        where: { id: sale.fromId, active: true, type: "warehouse" },
      });
      if (!warehouse) {
        throw new BadRequestException("Sale warehouse is not active");
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

      return tx.stockMove.create({
        data: {
          type: returnType,
          channel: sale.channel,
          toId: sale.fromId,
          customerId: sale.customerId ?? undefined,
          relatedMoveId: sale.id,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: `RETURN-${sale.reference ?? sale.id}`,
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
