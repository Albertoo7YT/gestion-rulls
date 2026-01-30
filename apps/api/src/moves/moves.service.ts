import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { SeriesService } from "../common/series.service";
import { AdjustMoveDto } from "./dto/adjust-move.dto";
import { B2bSaleMoveDto } from "./dto/b2b-sale-move.dto";
import { PurchaseMoveDto } from "./dto/purchase-move.dto";
import { TransferMoveDto } from "./dto/transfer-move.dto";

@Injectable()
export class MovesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly seriesService: SeriesService,
  ) {}

  async list(params?: {
    types?: string;
    q?: string;
    from?: string;
    to?: string;
    series?: string;
    page?: number;
    limit?: number;
  }) {
    const normalizeDate = (
      value: string,
      boundary: "start" | "end",
    ): Date => {
      const hasTime = value.includes("T");
      const date = new Date(value);
      if (!hasTime && !Number.isNaN(date.getTime())) {
        if (boundary === "start") {
          date.setHours(0, 0, 0, 0);
        } else {
          date.setHours(23, 59, 59, 999);
        }
      }
      return date;
    };

    const types = params?.types;
    const defaultTypes = [StockMoveType.b2b_sale, StockMoveType.b2c_sale];
    const parsed = types
      ? types
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : [];

    const allowed = new Set(Object.values(StockMoveType));
    const typeFilter = parsed.length
      ? parsed.filter((value) => allowed.has(value as StockMoveType))
      : defaultTypes;

    if (!typeFilter.length) {
      throw new BadRequestException("types contains no valid move types");
    }

    const where: Prisma.StockMoveWhereInput = {
      type: { in: typeFilter as StockMoveType[] },
    };

    if (params?.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { reference: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (params?.series?.trim()) {
      const series = params.series.trim();
      where.AND = [
        ...(where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : []),
        {
          OR: [
            { seriesCode: { contains: series, mode: "insensitive" } },
            { reference: { contains: series, mode: "insensitive" } },
          ],
        },
      ];
    }

    const dateFilter: Prisma.DateTimeFilter = {};
    if (params?.from) {
      dateFilter.gte = normalizeDate(params.from, "start");
    }
    if (params?.to) {
      dateFilter.lte = normalizeDate(params.to, "end");
    }
    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const page =
      params?.page && params.page > 0 ? Math.floor(params.page) : undefined;
    const limit =
      params?.limit && params.limit > 0 ? Math.min(Math.floor(params.limit), 200) : undefined;

    const baseQuery = {
      where,
      orderBy: [{ date: "desc" as const }, { id: "desc" as const }],
      select: {
        id: true,
        type: true,
        date: true,
        reference: true,
        seriesCode: true,
        seriesYear: true,
        seriesNumber: true,
        channel: true,
        notes: true,
        paymentStatus: true,
        paidAmount: true,
        customer: { select: { name: true } },
        lines: { select: { quantity: true, unitPrice: true, addOnPrice: true } },
      },
    };

    if (page && limit) {
      const [total, moves] = await this.prisma.$transaction([
        this.prisma.stockMove.count({ where }),
        this.prisma.stockMove.findMany({
          ...baseQuery,
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);
      const items = moves.map((move) => {
        const totalPrice = move.lines.reduce((sum, line) => {
          const price = line.unitPrice ? Number(line.unitPrice) : 0;
          const addOn = line.addOnPrice ? Number(line.addOnPrice) : 0;
          return sum + price * line.quantity + addOn;
        }, 0);
        const units = move.lines.reduce((sum, line) => sum + line.quantity, 0);
        const buyer =
          move.customer?.name || (move.channel === "B2C" ? "Publico" : "-");
        return {
          id: move.id,
          type: move.type,
          date: move.date,
          reference: move.reference,
          seriesCode: move.seriesCode,
          seriesYear: move.seriesYear,
          seriesNumber: move.seriesNumber,
          buyer,
          units,
          total: totalPrice,
          paymentStatus: move.paymentStatus,
          paidAmount: Number(move.paidAmount ?? 0),
        };
      });
      return { items, total, page, pageSize: limit };
    }

    const moves = await this.prisma.stockMove.findMany({
      ...baseQuery,
    });

    return moves.map((move) => {
      const total = move.lines.reduce((sum, line) => {
        const price = line.unitPrice ? Number(line.unitPrice) : 0;
        const addOn = line.addOnPrice ? Number(line.addOnPrice) : 0;
        return sum + price * line.quantity + addOn;
      }, 0);
      const units = move.lines.reduce((sum, line) => sum + line.quantity, 0);
      const buyer =
        move.customer?.name || (move.channel === "B2C" ? "Publico" : "-");
      return {
        id: move.id,
        type: move.type,
        date: move.date,
        reference: move.reference,
        seriesCode: move.seriesCode,
        seriesYear: move.seriesYear,
        seriesNumber: move.seriesNumber,
        buyer,
        units,
        total,
        paymentStatus: move.paymentStatus,
        paidAmount: Number(move.paidAmount ?? 0),
      };
    });
  }

  async getById(id: number) {
    const move = await this.prisma.stockMove.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        channel: true,
        date: true,
        fromId: true,
        toId: true,
        reference: true,
        notes: true,
        customerId: true,
        paymentStatus: true,
        paidAmount: true,
        customer: { select: { name: true } },
        lines: {
          select: {
            sku: true,
            quantity: true,
            unitPrice: true,
            addOnPrice: true,
            addOnCost: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    if (!move) {
      throw new NotFoundException(`Move ${id} not found`);
    }

    return move;
  }

  async update(
    id: number,
    dto: {
      reference?: string;
      notes?: string;
      date?: string;
      paymentStatus?: "pending" | "partial" | "paid";
      paidAmount?: number;
    },
  ) {
    const existing = await this.prisma.stockMove.findUnique({
      where: { id },
      select: {
        id: true,
        paymentStatus: true,
        paidAmount: true,
        lines: { select: { quantity: true, unitPrice: true, addOnPrice: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException(`Move ${id} not found`);
    }

    const total = existing.lines.reduce((sum, line) => {
      const price = line.unitPrice ? Number(line.unitPrice) : 0;
      const addOn = line.addOnPrice ? Number(line.addOnPrice) : 0;
      return sum + price * line.quantity + addOn;
    }, 0);

    let paymentStatus = dto.paymentStatus ?? existing.paymentStatus;
    let paidAmount =
      dto.paidAmount != null ? Number(dto.paidAmount) : Number(existing.paidAmount ?? 0);

    if (paymentStatus === "paid") {
      paidAmount = total;
    } else if (paymentStatus === "pending") {
      paidAmount = 0;
    } else if (paymentStatus === "partial") {
      if (paidAmount <= 0 || paidAmount >= total) {
        throw new BadRequestException("paidAmount must be between 0 and total");
      }
    }
    if (paidAmount >= total && total > 0) {
      paymentStatus = "paid";
      paidAmount = total;
    }

    return this.prisma.stockMove.update({
      where: { id },
      data: {
        reference: dto.reference,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : undefined,
        paymentStatus,
        paidAmount,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.stockMove.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(`Move ${id} not found`);
      }
      await tx.stockMove.updateMany({
        where: { relatedMoveId: id },
        data: { relatedMoveId: null },
      });
      await tx.stockMoveLine.deleteMany({ where: { moveId: id } });
      return tx.stockMove.delete({ where: { id } });
    });
  }

  async createPurchase(dto: PurchaseMoveDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const to = await this.getLocationOrThrow(tx, dto.toId);
      if (to.type !== "warehouse") {
        throw new BadRequestException("Purchase must go to a warehouse");
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));

      const created = await tx.stockMove.create({
        data: {
          type: StockMoveType.purchase,
          channel: StockMoveChannel.INTERNAL,
          toId: dto.toId,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/moves/purchase",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: "purchase",
          toId: created.toId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  async createTransfer(dto: TransferMoveDto, userId?: number) {
    if (dto.fromId === dto.toId) {
      throw new BadRequestException("fromId and toId cannot be the same");
    }

    return this.prisma.$transaction(async (tx) => {
      const from = await this.getLocationOrThrow(tx, dto.fromId);
      const to = await this.getLocationOrThrow(tx, dto.toId);
      const fromAllowed = from.type === "warehouse" || from.type === "retail";
      const toAllowed = to.type === "warehouse" || to.type === "retail";
      if (!fromAllowed || !toAllowed || (from.type === "retail" && to.type === "retail")) {
        throw new BadRequestException(
          "Transfer must be warehouse to warehouse or warehouse/retail",
        );
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));
      await this.ensureNoNegativeStock(tx, dto.fromId, dto.lines);

      const notes = dto.notes?.trim();
      const isDeposit = notes?.toUpperCase().startsWith("DEPOSITO");
      let seriesData:
        | { reference: string; seriesCode: string; seriesYear: number | null; seriesNumber: number }
        | null = null;
      if (!dto.reference && isDeposit) {
        seriesData = await this.seriesService.allocate(
          tx,
          "deposit",
          dto.date ? new Date(dto.date) : new Date(),
        );
      }

      const created = await tx.stockMove.create({
        data: {
          type: StockMoveType.transfer,
          channel: StockMoveChannel.INTERNAL,
          fromId: dto.fromId,
          toId: dto.toId,
          customerId: dto.customerId,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference ?? seriesData?.reference,
          seriesCode: seriesData?.seriesCode,
          seriesYear: seriesData?.seriesYear ?? undefined,
          seriesNumber: seriesData?.seriesNumber,
          notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/moves/transfer",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: "transfer",
          fromId: created.fromId,
          toId: created.toId,
          customerId: created.customerId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  async createB2bSale(dto: B2bSaleMoveDto, userId?: number) {
    if (dto.fromId === dto.toId) {
      throw new BadRequestException("fromId and toId cannot be the same");
    }

    return this.prisma.$transaction(async (tx) => {
      const from = await this.getLocationOrThrow(tx, dto.fromId);
      const to = await this.getLocationOrThrow(tx, dto.toId);
      if (from.type !== "warehouse" || to.type !== "retail") {
        throw new BadRequestException("B2B sale must be warehouse to retail");
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));
      await this.ensureNoNegativeStock(tx, dto.fromId, dto.lines);

      let seriesData:
        | { reference: string; seriesCode: string; seriesYear: number | null; seriesNumber: number }
        | null = null;
      if (!dto.reference) {
        seriesData = await this.seriesService.allocate(
          tx,
          "sale_b2b",
          dto.date ? new Date(dto.date) : new Date(),
        );
      }

      const created = await tx.stockMove.create({
        data: {
          type: StockMoveType.b2b_sale,
          channel: StockMoveChannel.B2B,
          fromId: dto.fromId,
          toId: dto.toId,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference ?? seriesData?.reference,
          seriesCode: seriesData?.seriesCode,
          seriesYear: seriesData?.seriesYear ?? undefined,
          seriesNumber: seriesData?.seriesNumber,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/moves/b2b-sale",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: "b2b_sale",
          fromId: created.fromId,
          toId: created.toId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  async createAdjust(dto: AdjustMoveDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.getLocationOrThrow(tx, dto.locationId);
      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));

      if (dto.direction === "out" && !dto.allowNegativeAdjust) {
        await this.ensureNoNegativeStock(tx, dto.locationId, dto.lines);
      }

      const created = await tx.stockMove.create({
        data: {
          type: StockMoveType.adjust,
          channel: StockMoveChannel.INTERNAL,
          fromId: dto.direction === "out" ? dto.locationId : undefined,
          toId: dto.direction === "in" ? dto.locationId : undefined,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/moves/adjust",
        action: "stock_change",
        entity: "stock_move",
        entityId: created.id.toString(),
        requestBody: {
          type: "adjust",
          fromId: created.fromId,
          toId: created.toId,
          lines: created.lines,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  private async getLocationOrThrow(
    tx: Prisma.TransactionClient,
    id: number,
  ) {
    const location = await tx.location.findFirst({
      where: { id, active: true },
    });
    if (!location) {
      throw new NotFoundException(`Location ${id} not found or inactive`);
    }
    return location;
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
