import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ExportManifest = {
  version: string;
  createdAt: string;
};

const EXPORT_VERSION = "1.0.0";

@Injectable()
export class ExportImportService {
  private readonly logger = new Logger(ExportImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildExport() {
    const [
      products,
      locations,
      stockMoves,
      stockMoveLines,
      webOrders,
      webOrderLines,
      settings,
    ] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        select: {
          sku: true,
          name: true,
          type: true,
          photoUrl: true,
          photoUrls: true,
          description: true,
          cost: true,
          rrp: true,
          active: true,
        },
      }),
      this.prisma.location.findMany({
        select: {
          id: true,
          type: true,
          name: true,
          city: true,
          active: true,
          legalName: true,
          taxId: true,
          address: true,
          postalCode: true,
          province: true,
          country: true,
          phone: true,
          contactName: true,
          email: true,
          paymentTerms: true,
          notes: true,
        },
      }),
      this.prisma.stockMove.findMany({
        select: {
          id: true,
          date: true,
          type: true,
          channel: true,
          fromId: true,
          toId: true,
          customerId: true,
          relatedMoveId: true,
          reference: true,
          notes: true,
        },
      }),
      this.prisma.stockMoveLine.findMany({
        select: {
          id: true,
          moveId: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          unitCost: true,
        },
      }),
      this.prisma.webOrder.findMany({
        select: {
          wooOrderId: true,
          number: true,
          status: true,
          createdAtWoo: true,
          customerName: true,
          email: true,
          total: true,
          currency: true,
          assignedWarehouseId: true,
          importedAt: true,
          processedAt: true,
          notes: true,
        },
      }),
      this.prisma.webOrderLine.findMany({
        select: {
          id: true,
          wooOrderId: true,
          sku: true,
          qty: true,
          price: true,
          lineTotal: true,
        },
      }),
      this.prisma.settings.findMany({
        select: {
          id: true,
          wooSyncEnabled: true,
          wooStockWarehouseIds: true,
          lastWooSyncAt: true,
        },
      }),
    ]);

    const manifest: ExportManifest = {
      version: EXPORT_VERSION,
      createdAt: new Date().toISOString(),
    };

    const payload = {
      manifest,
      products,
      locations,
      stock_moves: stockMoves,
      stock_move_lines: stockMoveLines,
      web_orders: webOrders,
      web_order_lines: webOrderLines,
      settings,
    };

    this.logger.log(
      `Export built: products=${products.length}, locations=${locations.length}, moves=${stockMoves.length}, orders=${webOrders.length}`,
    );

    return payload;
  }

  async importData(
    data: {
      manifest: ExportManifest;
      products: Prisma.ProductCreateManyInput[];
      locations: Prisma.LocationCreateManyInput[];
      stock_moves: Prisma.StockMoveCreateManyInput[];
      stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
      web_orders: Prisma.WebOrderCreateManyInput[];
      web_order_lines: Prisma.WebOrderLineCreateManyInput[];
      settings: Prisma.SettingsCreateManyInput[];
    },
    mode: "restore" | "merge",
  ) {
    this.validateManifest(data.manifest);

    this.logger.log(`Import mode: ${mode}`);
    if (mode === "restore") {
      await this.restoreAll(data);
      return { mode, restored: true };
    }

    await this.mergeAll(data);
    return { mode, restored: false };
  }

  private validateManifest(manifest: ExportManifest) {
    if (!manifest || manifest.version !== EXPORT_VERSION) {
      throw new BadRequestException("Invalid export manifest version");
    }
  }

  private async restoreAll(data: {
    products: Prisma.ProductCreateManyInput[];
    locations: Prisma.LocationCreateManyInput[];
    stock_moves: Prisma.StockMoveCreateManyInput[];
    stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
    web_orders: Prisma.WebOrderCreateManyInput[];
    web_order_lines: Prisma.WebOrderLineCreateManyInput[];
    settings: Prisma.SettingsCreateManyInput[];
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.stockMoveLine.deleteMany();
      await tx.stockMove.deleteMany();
      await tx.webOrderLine.deleteMany();
      await tx.webOrder.deleteMany();
      await tx.product.deleteMany();
      await tx.location.deleteMany();
      await tx.settings.deleteMany();

      if (data.locations.length > 0) {
        await tx.location.createMany({ data: data.locations });
      }
      if (data.products.length > 0) {
        await tx.product.createMany({ data: data.products });
      }
      if (data.settings.length > 0) {
        await tx.settings.createMany({ data: data.settings });
      }
      if (data.stock_moves.length > 0) {
        const movesWithoutRelated = data.stock_moves.map(
          ({ relatedMoveId, ...move }) => move,
        );
        await tx.stockMove.createMany({ data: movesWithoutRelated });
        for (const move of data.stock_moves) {
          if (move.relatedMoveId) {
            await tx.stockMove.update({
              where: { id: move.id },
              data: { relatedMoveId: move.relatedMoveId },
            });
          }
        }
      }
      if (data.stock_move_lines.length > 0) {
        await tx.stockMoveLine.createMany({ data: data.stock_move_lines });
      }
      if (data.web_orders.length > 0) {
        await tx.webOrder.createMany({ data: data.web_orders });
      }
      if (data.web_order_lines.length > 0) {
        await tx.webOrderLine.createMany({ data: data.web_order_lines });
      }
    });
  }

  private async mergeAll(data: {
    products: Prisma.ProductCreateManyInput[];
    locations: Prisma.LocationCreateManyInput[];
    stock_moves: Prisma.StockMoveCreateManyInput[];
    stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
    web_orders: Prisma.WebOrderCreateManyInput[];
    web_order_lines: Prisma.WebOrderLineCreateManyInput[];
    settings: Prisma.SettingsCreateManyInput[];
  }) {
    await this.prisma.$transaction(async (tx) => {
      for (const loc of data.locations) {
        await tx.location.upsert({
          where: { id: loc.id },
          update: { ...loc },
          create: { ...loc },
        });
      }

      for (const prod of data.products) {
        await tx.product.upsert({
          where: { sku: prod.sku },
          update: { ...prod },
          create: { ...prod },
        });
      }

      for (const setting of data.settings) {
        await tx.settings.upsert({
          where: { id: setting.id },
          update: { ...setting },
          create: { ...setting },
        });
      }

      const existingMoves = new Set(
        (await tx.stockMove.findMany({ select: { id: true } })).map(
          (m) => m.id,
        ),
      );
      const newMoveIds: number[] = [];
      for (const move of data.stock_moves) {
        if (existingMoves.has(move.id)) continue;
        const { relatedMoveId, ...moveData } = move;
        await tx.stockMove.create({ data: moveData });
        newMoveIds.push(move.id);
      }
      for (const move of data.stock_moves) {
        if (!move.relatedMoveId) continue;
        if (!newMoveIds.includes(move.id)) continue;
        await tx.stockMove.update({
          where: { id: move.id },
          data: { relatedMoveId: move.relatedMoveId },
        });
      }

      const linesToInsert = data.stock_move_lines.filter((line) =>
        newMoveIds.includes(line.moveId),
      );
      if (linesToInsert.length > 0) {
        await tx.stockMoveLine.createMany({ data: linesToInsert });
      }

      for (const order of data.web_orders) {
        await tx.webOrder.upsert({
          where: { wooOrderId: order.wooOrderId },
          update: { ...order },
          create: { ...order },
        });
      }

      const orderIds = data.web_orders.map((o) => o.wooOrderId);
      if (orderIds.length > 0) {
        await tx.webOrderLine.deleteMany({
          where: { wooOrderId: { in: orderIds } },
        });
      }
      if (data.web_order_lines.length > 0) {
        await tx.webOrderLine.createMany({ data: data.web_order_lines });
      }
    });
  }
}
