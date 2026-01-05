import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  list(status?: string) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
      },
      include: { supplier: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async get(id: number) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: true },
    });
    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }
    return order;
  }

  async create(dto: CreatePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, active: true },
      });
      if (!supplier) {
        throw new BadRequestException("supplierId must be an active supplier");
      }

      const customNumber = dto.number?.trim();
      if (customNumber) {
        const existing = await tx.purchaseOrder.findFirst({
          where: { number: customNumber },
          select: { id: true },
        });
        if (existing) {
          throw new BadRequestException("number already exists");
        }
      }

      const tempNumber = `PO-TMP-${Date.now()}-${Math.floor(
        Math.random() * 1000,
      )}`;
      const initialNumber = customNumber || tempNumber;

      await this.ensureProductsExistOrCreate(tx, dto.lines, dto.supplierId);

      const created = await tx.purchaseOrder.create({
        data: {
          number: initialNumber,
          status: dto.status ?? "draft",
          supplierId: dto.supplierId,
          notes: dto.notes?.trim(),
          orderedAt: dto.status === "ordered" ? new Date() : undefined,
          lines: {
            create: dto.lines.map((line) => ({
              sku: line.sku,
              productName: line.productName?.trim(),
              manufacturerRef: line.manufacturerRef?.trim(),
              productType: line.productType,
              quantity: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
        include: { supplier: true, lines: true },
      });

      if (customNumber) {
        return created;
      }

      const finalNumber = `PO-${String(created.id).padStart(6, "0")}`;
      return tx.purchaseOrder.update({
        where: { id: created.id },
        data: { number: finalNumber },
        include: { supplier: true, lines: true },
      });
    });
  }

  async update(id: number, dto: UpdatePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException("Purchase order not found");
      }
      if (order.status === "received") {
        throw new BadRequestException("Received orders cannot be edited");
      }

      if (dto.number !== undefined) {
        const customNumber = dto.number.trim();
        if (!customNumber) {
          throw new BadRequestException("number cannot be empty");
        }
        const existing = await tx.purchaseOrder.findFirst({
          where: { number: customNumber, NOT: { id } },
          select: { id: true },
        });
        if (existing) {
          throw new BadRequestException("number already exists");
        }
      }

      if (dto.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: dto.supplierId, active: true },
        });
        if (!supplier) {
          throw new BadRequestException("supplierId must be an active supplier");
        }
      }

      if (dto.lines) {
        await this.ensureProductsExistOrCreate(
          tx,
          dto.lines,
          dto.supplierId ?? order.supplierId,
        );
        await tx.purchaseOrderLine.deleteMany({
          where: { purchaseOrderId: id },
        });
        await tx.purchaseOrderLine.createMany({
          data: dto.lines.map((line) => ({
            purchaseOrderId: id,
            sku: line.sku,
            productName: line.productName?.trim(),
            manufacturerRef: line.manufacturerRef?.trim(),
            productType: line.productType,
            quantity: line.quantity,
            unitCost: line.unitCost,
          })),
        });
      }

      const nextStatus = dto.status ?? order.status;
      return tx.purchaseOrder.update({
        where: { id },
        data: {
          number: dto.number?.trim() ?? order.number,
          supplierId: dto.supplierId ?? order.supplierId,
          status: nextStatus,
          notes: dto.notes?.trim(),
          orderedAt:
            nextStatus === "ordered" && !order.orderedAt
              ? new Date()
              : order.orderedAt,
        },
        include: { supplier: true, lines: true },
      });
    });
  }

  async receive(id: number, dto: ReceivePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!order) {
        throw new NotFoundException("Purchase order not found");
      }
      if (order.status === "received") {
        throw new BadRequestException("Purchase order already received");
      }
      if (order.status === "cancelled") {
        throw new BadRequestException("Cancelled orders cannot be received");
      }
      if (!order.lines.length) {
        throw new BadRequestException("Purchase order has no lines");
      }

      const warehouse = await tx.location.findFirst({
        where: { id: dto.warehouseId, active: true, type: "warehouse" },
      });
      if (!warehouse) {
        throw new BadRequestException("warehouseId must be an active warehouse");
      }

      await this.ensureProductsExistOrCreate(tx, order.lines, order.supplierId);

      const move = await tx.stockMove.create({
        data: {
          type: StockMoveType.purchase,
          channel: StockMoveChannel.INTERNAL,
          toId: dto.warehouseId,
          reference: order.number,
          notes: dto.notes?.trim(),
          date: dto.date ? new Date(dto.date) : undefined,
          lines: {
            create: order.lines.map((line) => ({
              sku: line.sku,
              quantity: line.quantity,
              unitCost: line.unitCost,
            })),
          },
        },
        include: { lines: true },
      });

      const mergedNotes = dto.notes
        ? `${order.notes ? `${order.notes} | ` : ""}${dto.notes}`
        : order.notes;

      const updatedOrder = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: "received",
          receivedAt: dto.date ? new Date(dto.date) : new Date(),
          notes: mergedNotes,
        },
        include: { supplier: true, lines: true },
      });

      return { order: updatedOrder, move };
    });
  }

  private async ensureProductsExistOrCreate(
    tx: Prisma.TransactionClient,
    lines: {
      sku: string;
      productName?: string | null;
      manufacturerRef?: string | null;
      productType?: "standard" | "quick" | null;
      unitCost?: Prisma.Decimal | number | null;
    }[],
    supplierId?: number | null,
  ) {
    const uniqueSkus = Array.from(new Set(lines.map((line) => line.sku)));
    const existing = await tx.product.findMany({
      where: { sku: { in: uniqueSkus } },
      select: { sku: true },
    });
    const existingSet = new Set(existing.map((p) => p.sku));
    const missing = uniqueSkus.filter((sku) => !existingSet.has(sku));

    for (const sku of missing) {
      const line = lines.find((l) => l.sku === sku);
      const name = line?.productName?.trim() || sku;
      await tx.product.create({
        data: {
          sku,
          name,
          type: (line?.productType ?? "standard") as any,
          manufacturerRef: line?.manufacturerRef?.trim() || null,
          cost: line?.unitCost ?? undefined,
          supplierId: supplierId ?? undefined,
          active: true,
        },
      });
    }
  }
}
