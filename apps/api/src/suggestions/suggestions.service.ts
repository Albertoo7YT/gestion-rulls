import { Injectable } from "@nestjs/common";
import { Prisma, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PurchaseSuggestionsQueryDto } from "./dto/purchase-suggestions-query.dto";

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async purchaseSuggestions(query: PurchaseSuggestionsQueryDto) {
    const minStock = query.minStock ?? 3;
    const days = query.days ?? 30;
    const limit = query.limit ?? 50;

    return this.prisma.$queryRaw<
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
        WHERE m."date" >= NOW() - (${days}::text || ' days')::interval
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
      LIMIT ${limit}
    `;
  }
}
