import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WebOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  listOrders() {
    return this.prisma.webOrder.findMany({
      orderBy: { createdAtWoo: "desc" },
    });
  }

  async assignWarehouse(wooOrderId: string, warehouseId: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.webOrder.findUnique({ where: { wooOrderId } });
      if (!order) {
        throw new NotFoundException("Order not found");
      }

      const warehouse = await tx.location.findFirst({
        where: { id: warehouseId, active: true },
      });
      if (!warehouse || warehouse.type !== "warehouse") {
        throw new BadRequestException(
          "warehouseId must be an active warehouse",
        );
      }

      return tx.webOrder.update({
        where: { wooOrderId },
        data: { assignedWarehouseId: warehouseId },
      });
    });
  }

  async processOrder(wooOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.webOrder.findUnique({
        where: { wooOrderId },
        include: { lines: true },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }
      if (order.processedAt) {
        throw new BadRequestException("Order already processed");
      }
      if (!order.assignedWarehouseId) {
        throw new BadRequestException("Order must have assignedWarehouseId");
      }

      const warehouse = await tx.location.findFirst({
        where: { id: order.assignedWarehouseId, active: true },
      });
      if (!warehouse || warehouse.type !== "warehouse") {
        throw new BadRequestException(
          "assignedWarehouseId must be an active warehouse",
        );
      }

      const totals = new Map<string, number>();
      for (const line of order.lines) {
        totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.qty);
      }

      for (const [sku, qty] of totals.entries()) {
        const available = await this.getStockForSku(
          tx,
          order.assignedWarehouseId,
          sku,
        );
        if (available - qty < 0) {
          throw new BadRequestException(
            `Insufficient stock for ${sku} at warehouse ${order.assignedWarehouseId}`,
          );
        }
      }

      const move = await tx.stockMove.create({
        data: {
          type: StockMoveType.b2c_sale,
          channel: StockMoveChannel.B2C,
          fromId: order.assignedWarehouseId,
          toId: null,
          reference: wooOrderId,
          lines: {
            create: order.lines.map((line) => ({
              sku: line.sku,
              quantity: line.qty,
              unitPrice: line.price,
              unitCost: null,
            })),
          },
        },
        include: { lines: true },
      });

      const updated = await tx.webOrder.update({
        where: { wooOrderId },
        data: { processedAt: new Date() },
      });

      return { order: updated, move };
    });
  }

  async markCompleted(wooOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.webOrder.findUnique({ where: { wooOrderId } });
      if (!order) {
        throw new NotFoundException("Order not found");
      }
      if (order.processedAt) {
        throw new BadRequestException("Order already processed");
      }
      return tx.webOrder.update({
        where: { wooOrderId },
        data: { processedAt: new Date() },
      });
    });
  }

  async removeOrder(wooOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.webOrder.findUnique({ where: { wooOrderId } });
      if (!existing) {
        throw new NotFoundException("Order not found");
      }
      await tx.webOrderLine.deleteMany({ where: { wooOrderId } });
      return tx.webOrder.delete({ where: { wooOrderId } });
    });
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
