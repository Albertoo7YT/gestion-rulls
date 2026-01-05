import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async getStock(locationId: number) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, active: true },
      select: { id: true },
    });

    if (!location) {
      throw new NotFoundException(`Location ${locationId} not found or inactive`);
    }

    const rows = await this.prisma.$queryRaw<
      { sku: string; name: string; quantity: number }[]
    >`
      SELECT p."sku",
             p."name",
             CAST(COALESCE(inc.in_qty, 0) - COALESCE(outg.out_qty, 0) AS INTEGER) AS quantity
      FROM "Product" p
      LEFT JOIN (
        SELECT l."sku", SUM(l."quantity") AS in_qty
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        WHERE m."toId" = ${locationId}
        GROUP BY l."sku"
      ) inc ON inc."sku" = p."sku"
      LEFT JOIN (
        SELECT l."sku", SUM(l."quantity") AS out_qty
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        WHERE m."fromId" = ${locationId}
        GROUP BY l."sku"
      ) outg ON outg."sku" = p."sku"
      ORDER BY p."sku" ASC
    `;

    return rows;
  }
}
