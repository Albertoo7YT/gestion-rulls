import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AdjustMoveDto } from "./dto/adjust-move.dto";
import { B2bSaleMoveDto } from "./dto/b2b-sale-move.dto";
import { PurchaseMoveDto } from "./dto/purchase-move.dto";
import { TransferMoveDto } from "./dto/transfer-move.dto";

@Injectable()
export class MovesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(types?: string) {
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

    const moves = await this.prisma.stockMove.findMany({
      where: { type: { in: typeFilter as StockMoveType[] } },
      orderBy: { date: "desc" },
      select: {
        id: true,
        type: true,
        date: true,
        reference: true,
        channel: true,
        notes: true,
        customer: { select: { name: true } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
    });

    return moves.map((move) => {
      const total = move.lines.reduce((sum, line) => {
        const price = line.unitPrice ? Number(line.unitPrice) : 0;
        return sum + price * line.quantity;
      }, 0);
      const units = move.lines.reduce((sum, line) => sum + line.quantity, 0);
      const buyer =
        move.customer?.name || (move.channel === "B2C" ? "Publico" : "-");
      return {
        id: move.id,
        type: move.type,
        date: move.date,
        reference: move.reference,
        buyer,
        units,
        total,
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
        customer: { select: { name: true } },
        lines: {
          select: {
            sku: true,
            quantity: true,
            unitPrice: true,
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
    dto: { reference?: string; notes?: string; date?: string },
  ) {
    const existing = await this.prisma.stockMove.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Move ${id} not found`);
    }

    return this.prisma.stockMove.update({
      where: { id },
      data: {
        reference: dto.reference,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : undefined,
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

  async createPurchase(dto: PurchaseMoveDto) {
    return this.prisma.$transaction(async (tx) => {
      const to = await this.getLocationOrThrow(tx, dto.toId);
      if (to.type !== "warehouse") {
        throw new BadRequestException("Purchase must go to a warehouse");
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));

      return tx.stockMove.create({
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
    });
  }

  async createTransfer(dto: TransferMoveDto) {
    if (dto.fromId === dto.toId) {
      throw new BadRequestException("fromId and toId cannot be the same");
    }

    return this.prisma.$transaction(async (tx) => {
      const from = await this.getLocationOrThrow(tx, dto.fromId);
      const to = await this.getLocationOrThrow(tx, dto.toId);
      if (from.type !== "warehouse" || to.type !== "warehouse") {
        throw new BadRequestException("Transfer must be warehouse to warehouse");
      }

      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));
      await this.ensureNoNegativeStock(tx, dto.fromId, dto.lines);

      return tx.stockMove.create({
        data: {
          type: StockMoveType.transfer,
          channel: StockMoveChannel.INTERNAL,
          fromId: dto.fromId,
          toId: dto.toId,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
    });
  }

  async createB2bSale(dto: B2bSaleMoveDto) {
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

      return tx.stockMove.create({
        data: {
          type: StockMoveType.b2b_sale,
          channel: StockMoveChannel.B2B,
          fromId: dto.fromId,
          toId: dto.toId,
          date: dto.date ? new Date(dto.date) : undefined,
          reference: dto.reference,
          notes: dto.notes,
          lines: { create: dto.lines },
        },
        include: { lines: true },
      });
    });
  }

  async createAdjust(dto: AdjustMoveDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.getLocationOrThrow(tx, dto.locationId);
      await this.ensureProductsExist(tx, dto.lines.map((line) => line.sku));

      if (dto.direction === "out" && !dto.allowNegativeAdjust) {
        await this.ensureNoNegativeStock(tx, dto.locationId, dto.lines);
      }

      return tx.stockMove.create({
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
