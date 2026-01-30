import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuditService } from "./audit/audit.service";
import { MovesService } from "./moves/moves.service";
import { CreateDepositReturnDto, CreateDepositSaleDto } from "./deposits.dto";
import { SeriesService } from "./common/series.service";

type DepositCustomerSummary = {
  customerId: number;
  name: string;
  units: number;
  cost: number;
};

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly movesService: MovesService,
    private readonly seriesService: SeriesService,
  ) {}

  async listCustomers(): Promise<DepositCustomerSummary[]> {
    const moves = await this.prisma.stockMove.findMany({
      where: {
        type: StockMoveType.transfer,
        notes: { startsWith: "DEPOSITO" },
        customerId: { not: null },
      },
      select: { customerId: true },
    });
    const ids = Array.from(new Set(moves.map((m) => m.customerId).filter(Boolean))) as number[];
    if (!ids.length) return [];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const lines = await this.prisma.stockMoveLine.findMany({
      where: {
        move: {
          type: StockMoveType.transfer,
          notes: { startsWith: "DEPOSITO" },
          customerId: { in: ids },
        },
      },
      select: { sku: true, quantity: true, move: { select: { customerId: true } } },
    });

    const products = await this.prisma.product.findMany({
      where: { sku: { in: Array.from(new Set(lines.map((l) => l.sku))) } },
      select: { sku: true, cost: true },
    });
    const costMap = new Map(products.map((p) => [p.sku, Number(p.cost ?? 0)]));

    const totals = new Map<number, { units: number; cost: number }>();
    for (const line of lines) {
      const customerId = line.move.customerId ?? 0;
      if (!customerId) continue;
      const current = totals.get(customerId) ?? { units: 0, cost: 0 };
      current.units += line.quantity;
      current.cost += (costMap.get(line.sku) ?? 0) * line.quantity;
      totals.set(customerId, current);
    }

    return ids.map((id) => ({
      customerId: id,
      name: customerMap.get(id)?.name ?? `Cliente ${id}`,
      units: totals.get(id)?.units ?? 0,
      cost: totals.get(id)?.cost ?? 0,
    }));
  }

  async getCustomerDeposit(customerId: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundException("Cliente no encontrado");

    const retail = await this.findRetailForCustomer(customer.name);
    if (!retail) {
      throw new BadRequestException("No hay tienda asociada a este cliente");
    }

    const depositSkus = await this.prisma.stockMoveLine.findMany({
      where: {
        move: {
          type: StockMoveType.transfer,
          notes: { startsWith: "DEPOSITO" },
          customerId,
        },
      },
      select: { sku: true },
    });
    const skuSet = new Set(depositSkus.map((l) => l.sku));
    if (!skuSet.size) {
      return { customer, retail, items: [] };
    }

    const stockMap = await this.getStockMapForLocation(retail.id);
    const skus = Array.from(skuSet);
    const products = await this.prisma.product.findMany({
      where: { sku: { in: skus } },
      select: { sku: true, name: true, cost: true },
    });
    const productMap = new Map(products.map((p) => [p.sku, p]));

    const items = skus
      .map((sku) => ({
        sku,
        name: productMap.get(sku)?.name ?? sku,
        cost: Number(productMap.get(sku)?.cost ?? 0),
        quantity: stockMap.get(sku) ?? 0,
      }))
      .filter((item) => item.quantity > 0);

    return { customer, retail, items };
  }

  async convertToSale(customerId: number, dto: CreateDepositSaleDto, userId?: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundException("Cliente no encontrado");

    const retail = await this.findRetailForCustomer(customer.name);
    if (!retail) {
      throw new BadRequestException("No hay tienda asociada a este cliente");
    }

    await this.ensureProductsExist(dto.lines.map((l) => l.sku));
    await this.ensureNoNegativeStock(retail.id, dto.lines);

    const created = await this.prisma.$transaction(async (tx) => {
      const seriesData = await this.seriesService.allocate(
        tx,
        "sale_b2b",
        new Date(),
      );

      return tx.stockMove.create({
        data: {
          type: StockMoveType.b2b_sale,
          channel: StockMoveChannel.B2B,
          fromId: retail.id,
          customerId,
          reference: seriesData.reference,
          seriesCode: seriesData.seriesCode,
          seriesYear: seriesData.seriesYear ?? undefined,
          seriesNumber: seriesData.seriesNumber,
          notes: dto.notes?.trim() || "DEPOSITO CONVERTIDO",
          lines: {
            create: dto.lines.map((line) => ({
              sku: line.sku,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
          },
        },
        include: { lines: true },
      });
    });

    await this.auditService.log({
      userId,
      method: "POST",
      path: `/deposits/customers/${customerId}/convert`,
      action: "stock_change",
      entity: "stock_move",
      entityId: created.id.toString(),
      requestBody: {
        type: "deposit_convert",
        customerId,
        fromId: retail.id,
        lines: created.lines,
      },
      statusCode: 201,
    });

    return created;
  }

  async returnToWarehouse(
    customerId: number,
    dto: CreateDepositReturnDto,
    userId?: number,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });
    if (!customer) throw new NotFoundException("Cliente no encontrado");

    const retail = await this.findRetailForCustomer(customer.name);
    if (!retail) {
      throw new BadRequestException("No hay tienda asociada a este cliente");
    }

    const payload = {
      fromId: retail.id,
      toId: dto.warehouseId,
      notes: dto.notes?.trim() || "DEPOSITO DEVUELTO",
      customerId,
      lines: dto.lines.map((line) => ({ sku: line.sku, quantity: line.quantity })),
    };

    return this.movesService.createTransfer(payload, userId);
  }

  private async findRetailForCustomer(customerName: string) {
    const existing = await this.prisma.location.findFirst({
      where: {
        type: "retail",
        active: true,
        name: { equals: customerName, mode: "insensitive" },
      },
    });
    if (existing) return existing;
    return this.prisma.location.create({
      data: {
        type: "retail",
        name: customerName,
        city: "",
        active: true,
      },
    });
  }

  private async getStockMapForLocation(locationId: number) {
    const incoming = await this.prisma.stockMoveLine.groupBy({
      by: ["sku"],
      _sum: { quantity: true },
      where: { move: { toId: locationId } },
    });
    const outgoing = await this.prisma.stockMoveLine.groupBy({
      by: ["sku"],
      _sum: { quantity: true },
      where: { move: { fromId: locationId } },
    });
    const map = new Map<string, number>();
    for (const row of incoming) {
      map.set(row.sku, row._sum.quantity ?? 0);
    }
    for (const row of outgoing) {
      map.set(row.sku, (map.get(row.sku) ?? 0) - (row._sum.quantity ?? 0));
    }
    return map;
  }

  private async ensureProductsExist(skus: string[]) {
    const unique = Array.from(new Set(skus));
    const products = await this.prisma.product.findMany({
      where: { sku: { in: unique } },
      select: { sku: true },
    });
    if (products.length !== unique.length) {
      throw new BadRequestException("Some SKUs do not exist");
    }
  }

  private async ensureNoNegativeStock(
    locationId: number,
    lines: { sku: string; quantity: number }[],
  ) {
    const totals = new Map<string, number>();
    for (const line of lines) {
      totals.set(line.sku, (totals.get(line.sku) ?? 0) + line.quantity);
    }
    const stock = await this.getStockMapForLocation(locationId);
    for (const [sku, qty] of totals.entries()) {
      if ((stock.get(sku) ?? 0) - qty < 0) {
        throw new BadRequestException(`Insufficient stock for ${sku} at location ${locationId}`);
      }
    }
  }
}
