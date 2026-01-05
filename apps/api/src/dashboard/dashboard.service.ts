import { Injectable } from "@nestjs/common";
import { Prisma, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const minStock = 3;
    const [
      productsActive,
      pendingOrders,
      salesToday,
      salesMonth,
      returnsMonth,
      salesMonthCount,
      lowStockCount,
      outOfStockCount,
      topLowStock,
      recentMoves,
      recentOrders,
    ] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.webOrder.count({
        where: {
          processedAt: null,
          status: { in: ["processing", "on-hold", "pending"] },
        },
      }),
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(COALESCE(l."unitPrice", 0) * l."quantity"), 0) AS total
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        WHERE m."type" IN (
          ${Prisma.sql`${StockMoveType.b2b_sale}::"StockMoveType"`},
          ${Prisma.sql`${StockMoveType.b2c_sale}::"StockMoveType"`}
        )
        AND m."date" >= date_trunc('day', now())
      `,
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(COALESCE(l."unitPrice", 0) * l."quantity"), 0) AS total
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        WHERE m."type" IN (
          ${Prisma.sql`${StockMoveType.b2b_sale}::"StockMoveType"`},
          ${Prisma.sql`${StockMoveType.b2c_sale}::"StockMoveType"`}
        )
        AND m."date" >= date_trunc('month', now())
      `,
      this.prisma.$queryRaw<{ total: string }[]>`
        SELECT COALESCE(SUM(COALESCE(l."unitPrice", 0) * l."quantity"), 0) AS total
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        WHERE m."type" IN (
          ${Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`},
          ${Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`}
        )
        AND m."date" >= date_trunc('month', now())
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT CAST(COALESCE(COUNT(DISTINCT m."id"), 0) AS INTEGER) AS total
        FROM "StockMove" m
        WHERE m."type" IN (
          ${Prisma.sql`${StockMoveType.b2b_sale}::"StockMoveType"`},
          ${Prisma.sql`${StockMoveType.b2c_sale}::"StockMoveType"`}
        )
        AND m."date" >= date_trunc('month', now())
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        WITH stock AS (
          SELECT l."sku" AS sku,
                 COALESCE(SUM(CASE WHEN m."toId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0)
                 - COALESCE(SUM(CASE WHEN m."fromId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0) AS stock
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          GROUP BY l."sku"
        )
        SELECT CAST(COALESCE(COUNT(*), 0) AS INTEGER) AS total
        FROM stock
        WHERE stock <= ${minStock}
      `,
      this.prisma.$queryRaw<{ total: number }[]>`
        WITH stock AS (
          SELECT l."sku" AS sku,
                 COALESCE(SUM(CASE WHEN m."toId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0)
                 - COALESCE(SUM(CASE WHEN m."fromId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0) AS stock
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          GROUP BY l."sku"
        )
        SELECT CAST(COALESCE(COUNT(*), 0) AS INTEGER) AS total
        FROM stock
        WHERE stock <= 0
      `,
      this.prisma.$queryRaw<
        {
          sku: string;
          name: string;
          stock: number;
          soldRecent: number;
          suggestedQty: number;
        }[]
      >`
        WITH stock AS (
          SELECT l."sku" AS sku,
                 COALESCE(SUM(CASE WHEN m."toId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0)
                 - COALESCE(SUM(CASE WHEN m."fromId" IS NOT NULL THEN l."quantity" ELSE 0 END), 0) AS stock
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          GROUP BY l."sku"
        ),
        sales AS (
          SELECT l."sku" AS sku,
                 COALESCE(SUM(CASE
                   WHEN m."type" IN (
                     ${Prisma.sql`${StockMoveType.b2b_sale}::"StockMoveType"`},
                     ${Prisma.sql`${StockMoveType.b2c_sale}::"StockMoveType"`}
                   ) THEN l."quantity"
                   WHEN m."type" IN (
                     ${Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`},
                     ${Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`}
                   ) THEN -l."quantity"
                   ELSE 0
                 END), 0) AS sold_recent
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          WHERE m."date" >= NOW() - interval '30 days'
          GROUP BY l."sku"
        )
        SELECT p."sku",
               p."name",
               CAST(COALESCE(s.stock, 0) AS INTEGER) AS stock,
               CAST(COALESCE(sa.sold_recent, 0) AS INTEGER) AS "soldRecent",
               CAST(GREATEST(COALESCE(sa.sold_recent, 0) - COALESCE(s.stock, 0), 0) AS INTEGER) AS "suggestedQty"
        FROM "Product" p
        LEFT JOIN stock s ON s.sku = p."sku"
        LEFT JOIN sales sa ON sa.sku = p."sku"
        WHERE COALESCE(sa.sold_recent, 0) > 0
          AND COALESCE(s.stock, 0) <= ${minStock}
        ORDER BY "suggestedQty" DESC, "soldRecent" DESC, p."sku" ASC
        LIMIT 5
      `,
      this.prisma.stockMove.findMany({
        take: 5,
        orderBy: { date: "desc" },
        select: {
          id: true,
          type: true,
          reference: true,
          date: true,
          fromId: true,
          toId: true,
        },
      }),
      this.prisma.webOrder.findMany({
        take: 5,
        orderBy: { createdAtWoo: "desc" },
        select: {
          wooOrderId: true,
          number: true,
          status: true,
          createdAtWoo: true,
        },
      }),
    ]);

    return {
      kpis: {
        productsActive,
        pendingOrders,
        salesToday: Number(salesToday[0]?.total ?? 0),
        salesMonth: Number(salesMonth[0]?.total ?? 0),
        returnsMonth: Number(returnsMonth[0]?.total ?? 0),
        netSalesMonth:
          Number(salesMonth[0]?.total ?? 0) -
          Number(returnsMonth[0]?.total ?? 0),
        salesMonthCount: salesMonthCount[0]?.total ?? 0,
        lowStockCount: lowStockCount[0]?.total ?? 0,
        outOfStockCount: outOfStockCount[0]?.total ?? 0,
        avgTicketMonth:
          (salesMonthCount[0]?.total ?? 0) > 0
            ? Number(salesMonth[0]?.total ?? 0) /
              (salesMonthCount[0]?.total ?? 0)
            : 0,
      },
      topLowStock,
      recentMoves,
      recentOrders,
    };
  }
}
