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

  async listOrders() {
    const orders = await this.prisma.webOrder.findMany({
      orderBy: { createdAtWoo: "desc" },
    });
    if (!orders.length) {
      return [];
    }

    const referenceCandidates = orders.flatMap((order) =>
      this.getWebReferenceCandidates(order),
    );

    const moves = await this.prisma.stockMove.findMany({
      where: { reference: { in: referenceCandidates } },
      select: { reference: true },
    });
    const moveRefs = new Set(moves.map((move) => move.reference ?? ""));

    return orders.map((order) => {
      const refs = this.getWebReferenceCandidates(order);
      const hasMove = refs.some((ref) => moveRefs.has(ref));
      return { ...order, hasMove };
    });
  }

  async getOrder(wooOrderId: string) {
    const order = await this.prisma.webOrder.findUnique({
      where: { wooOrderId },
      include: {
        assignedWarehouse: true,
        customer: true,
        lines: { include: { product: true } },
      },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    const hasMove = (await this.findExistingMoveForOrder(this.prisma, order)) != null;
    return { ...order, hasMove };
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

  async processOrder(
    wooOrderId: string,
    dto?: { addOns?: { accessoryId: number; quantity: number }[] },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.webOrder.findUnique({
        where: { wooOrderId },
        include: { lines: true },
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }
      if (order.processedAt) {
        const existingMove = await this.findExistingMoveForOrder(tx, order);
        if (existingMove) {
          return { order, move: existingMove };
        }
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

      const orderLinesTotal = order.lines.reduce(
        (sum, line) => sum + Number(line.price ?? 0) * line.qty,
        0,
      );
      const orderTotal = Number(order.total ?? 0);
      const extraRevenue = Math.max(0, orderTotal - orderLinesTotal);

      const skus = Array.from(totals.keys());
      const products = skus.length
        ? await tx.product.findMany({
            where: { sku: { in: skus } },
            select: { sku: true, cost: true },
          })
        : [];
      const costMap = new Map(
        products.map((product) => [product.sku, Number(product.cost ?? 0)]),
      );

      const addOnsInput = dto?.addOns ?? [];
      const addOnsIds = addOnsInput.map((item) => item.accessoryId);
      const accessories = addOnsIds.length
        ? await tx.accessory.findMany({
            where: { id: { in: addOnsIds }, active: true },
            select: { id: true, name: true, cost: true },
          })
        : [];
      const accessoryMap = new Map(
        accessories.map((acc) => [acc.id, acc]),
      );

      const addOnsResolved = addOnsInput
        .map((item) => {
          const acc = accessoryMap.get(item.accessoryId);
          if (!acc) return null;
          const quantity = Math.max(1, item.quantity);
          const cost = Number(acc.cost ?? 0);
          return {
            name: acc.name,
            quantity,
            price: 0,
            totalCost: cost * quantity,
          };
        })
        .filter(Boolean) as Array<{
        name: string;
        quantity: number;
        price: number;
        totalCost: number;
      }>;

      const totalAddOnCost = addOnsResolved.reduce(
        (sum, item) => sum + item.totalCost,
        0,
      );

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
          reference: await this.buildWebReference(tx, order),
          ...(await this.buildWebSeries(tx, order)),
          paymentStatus: "paid",
          paidAmount: order.total,
          lines: {
            create: order.lines.map((line, index) => ({
              sku: line.sku,
              quantity: line.qty,
              unitPrice: line.price,
              unitCost: costMap.get(line.sku) ?? null,
              addOnPrice: index === 0 ? extraRevenue : 0,
              addOnCost: index === 0 ? totalAddOnCost : 0,
              addOns:
                index === 0 && addOnsResolved.length > 0
                  ? addOnsResolved.map((item) => ({
                      name: item.name,
                      quantity: item.quantity,
                      price: item.price,
                    }))
                  : [],
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
    throw new BadRequestException("Mark completed disabled. Use process.");
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

  async reconcileProcessedOrders() {
    const processed = await this.prisma.webOrder.findMany({
      where: { processedAt: { not: null } },
      select: {
        wooOrderId: true,
        createdAtWoo: true,
        number: true,
        assignedWarehouseId: true,
      },
      orderBy: { createdAtWoo: "desc" },
    });

    const result: {
      total: number;
      created: number;
      skipped: number;
      errors: { wooOrderId: string; error: string }[];
    } = {
      total: processed.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const order of processed) {
      const existing = await this.findExistingMoveForOrder(this.prisma, order);
      if (existing) {
        result.skipped += 1;
        continue;
      }
      try {
        if (!order.assignedWarehouseId) {
          await this.prisma.webOrder.update({
            where: { wooOrderId: order.wooOrderId },
            data: { processedAt: null },
          });
          result.errors.push({
            wooOrderId: order.wooOrderId,
            error: "Sin almacen asignado. Revertido a pendiente.",
          });
          continue;
        }
        const created = await this.processOrder(order.wooOrderId);
        if (created?.move) {
          result.created += 1;
        } else {
          result.skipped += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        await this.prisma.webOrder.update({
          where: { wooOrderId: order.wooOrderId },
          data: { processedAt: null },
        });
        result.errors.push({
          wooOrderId: order.wooOrderId,
          error: `${message}. Revertido a pendiente.`,
        });
      }
    }

    return result;
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

  private async findExistingMoveForOrder(
    tx: Prisma.TransactionClient,
    order: { createdAtWoo: Date; number: string },
  ) {
    const references = this.getWebReferenceCandidates(order);
    return tx.stockMove.findFirst({
      where: { reference: { in: references } },
    });
  }

  private async buildWebSeries(
    tx: Prisma.TransactionClient,
    order: { createdAtWoo: Date; number: string },
  ) {
    const year = order.createdAtWoo.getFullYear();
    const series = await tx.documentSeries.findFirst({
      where: { scope: "web", active: true, OR: [{ year: null }, { year }] },
      orderBy: [{ year: "desc" }, { id: "asc" }],
    });
    if (!series) {
      return {};
    }

    const parsed = Number(String(order.number).replace(/\D/g, ""));
    const seriesNumber = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    return {
      seriesCode: series.code,
      seriesYear: series.year ?? year,
      seriesNumber: seriesNumber ?? undefined,
    };
  }

  private async buildWebReference(
    tx: Prisma.TransactionClient,
    order: { createdAtWoo: Date; number: string },
  ) {
    return this.getWebReference(order);
  }

  private getWebReference(order: { createdAtWoo: Date; number: string }) {
    const year = order.createdAtWoo.getFullYear();
    return `WEB-${year}-${order.number}`;
  }

  private getWebReferenceCandidates(order: {
    createdAtWoo: Date;
    number: string;
  }) {
    const year = order.createdAtWoo.getFullYear();
    const raw = String(order.number);
    const parsed = Number(raw.replace(/\D/g, ""));
    const padded =
      Number.isFinite(parsed) && parsed > 0 ? String(parsed).padStart(6, "0") : null;
    const refs = [`WEB-${year}-${raw}`];
    if (padded && padded !== raw) {
      refs.push(`WEB-${year}-${padded}`);
    }
    return refs;
  }
}
