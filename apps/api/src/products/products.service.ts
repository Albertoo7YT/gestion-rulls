import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateQuickProductDto } from "./dto/create-quick-product.dto";
import { ConvertToStandardDto } from "./dto/convert-to-standard.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  list(query: ListProductsQueryDto) {
    const search = query.search?.trim() ?? "";
    const normalized = search.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const isExactSku =
      normalized.length > 0 &&
      (/^[0-9]+$/.test(normalized) || /^RU[0-9]+$/.test(normalized));
    const exactSku = isExactSku
      ? normalized.startsWith("RU")
        ? normalized
        : `RU${normalized}`
      : "";
    return this.prisma.$queryRaw<
      {
        sku: string;
        name: string;
        type: string;
        photoUrl: string | null;
        photoUrls: Prisma.JsonValue | null;
        description: string | null;
        cost: number | null;
        rrp: number | null;
        b2bPrice: number | null;
        active: boolean;
        stock: number;
        categoryNames: string[] | null;
      }[]
    >`
      SELECT p."sku",
             p."name",
             p."type",
             p."photoUrl",
             p."photoUrls",
             p."description",
             p."manufacturerRef",
             p."color",
             p."cost",
             p."rrp",
             p."b2bPrice",
             p."active",
             CAST(COALESCE(inc.in_qty, 0) - COALESCE(outg.out_qty, 0) AS INTEGER) AS stock,
             cat."categoryNames"
      FROM "Product" p
      LEFT JOIN LATERAL (
        SELECT array_agg(c."name") AS "categoryNames"
        FROM "ProductCategory" pc
        JOIN "Category" c ON c."id" = pc."categoryId"
        WHERE pc."productSku" = p."sku"
      ) cat ON true
      LEFT JOIN (
        SELECT l."sku", SUM(l."quantity") AS in_qty
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        GROUP BY l."sku"
      ) inc ON inc."sku" = p."sku"
      LEFT JOIN (
        SELECT l."sku", SUM(l."quantity") AS out_qty
        FROM "StockMoveLine" l
        JOIN "StockMove" m ON m."id" = l."moveId"
        GROUP BY l."sku"
      ) outg ON outg."sku" = p."sku"
      WHERE (
        ${search} = ''
        OR (
          (
            ${isExactSku}
            AND regexp_replace(upper(p."sku"), '[^A-Z0-9]', '', 'g') = ${exactSku}
          )
          OR (
            NOT ${isExactSku}
            AND p."sku" ILIKE '%' || ${search} || '%'
          )
          OR p."name" ILIKE '%' || ${search} || '%'
        )
      )
      ORDER BY
        CASE
          WHEN ${search} = '' THEN 0
          WHEN ${isExactSku}
            AND regexp_replace(upper(p."sku"), '[^A-Z0-9]', '', 'g') = ${exactSku}
            THEN 0
          WHEN p."sku" ILIKE ${search} || '%' THEN 1
          WHEN p."sku" ILIKE '%' || ${search} || '%' THEN 2
          WHEN p."name" ILIKE '%' || ${search} || '%' THEN 3
          ELSE 4
        END,
        p."sku" ASC
    `;
  }

  async getBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });
    if (!product) {
      throw new NotFoundException("Product not found");
    }
    return {
      ...product,
      categoryIds: product.categories.map((c) => c.categoryId),
      categoryNames: product.categories.map((c) => c.category.name),
    };
  }

  async listMoves(sku: string) {
    await this.getBySku(sku);
    const lines = await this.prisma.stockMoveLine.findMany({
      where: { sku },
      orderBy: { move: { date: "desc" } },
      include: {
        move: {
          include: {
            from: true,
            to: true,
          },
        },
      },
    });

    return lines.map((line) => ({
      id: line.id,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
      move: {
        id: line.move.id,
        type: line.move.type,
        channel: line.move.channel,
        date: line.move.date,
        reference: line.move.reference,
        from: line.move.from
          ? { id: line.move.from.id, name: line.move.from.name }
          : null,
        to: line.move.to
          ? { id: line.move.to.id, name: line.move.to.name }
          : null,
      },
    }));
  }

  createStandard(data: CreateProductDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureCategories(tx, data.categoryIds);
      try {
        const created = await tx.product.create({
          data: {
            sku: data.sku,
            name: data.name,
            type: "standard",
            photoUrl: data.photoUrl,
            photoUrls: data.photoUrls,
            description: data.description,
            manufacturerRef: data.manufacturerRef,
            color: data.color,
            cost: data.cost,
            engravingCost: data.engravingCost,
            rrp: data.rrp,
            b2bPrice: data.b2bPrice,
            active: data.active ?? true,
            categories: data.categoryIds?.length
              ? {
                  create: data.categoryIds.map((categoryId) => ({
                    categoryId,
                  })),
                }
              : undefined,
          },
        });
        await this.auditService.log({
          userId,
          method: "POST",
          path: "/products",
          action: "price_change",
          entity: "product",
          entityId: created.sku,
          requestBody: {
            sku: created.sku,
            cost: created.cost,
            engravingCost: created.engravingCost,
            rrp: created.rrp,
            b2bPrice: created.b2bPrice,
          },
          statusCode: 201,
        });
        return created;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          throw new BadRequestException("SKU already exists");
        }
        throw err;
      }
    });
  }

  async createQuick(data: CreateQuickProductDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureCategories(tx, data.categoryIds);
      await tx.productCounter.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1, nextNumber: 1 },
      });

      const updated = await tx.productCounter.update({
        where: { id: 1 },
        data: { nextNumber: { increment: 1 } },
      });

      const sequence = updated.nextNumber - 1;
      const sku = `TMP-${String(sequence).padStart(4, "0")}`;

      const created = await tx.product.create({
        data: {
          sku,
          name: data.name,
          type: "quick",
          photoUrl: data.photoUrl,
          photoUrls: data.photoUrls,
          description: data.description,
          manufacturerRef: data.manufacturerRef,
          color: data.color,
          cost: data.cost,
          engravingCost: data.engravingCost,
          rrp: data.rrp,
          b2bPrice: data.b2bPrice,
          active: data.active ?? true,
          categories: data.categoryIds?.length
            ? {
                create: data.categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              }
            : undefined,
        },
      });
      await this.auditService.log({
        userId,
        method: "POST",
        path: "/products/quick",
        action: "price_change",
        entity: "product",
        entityId: created.sku,
        requestBody: {
          sku: created.sku,
          cost: created.cost,
          engravingCost: created.engravingCost,
          rrp: created.rrp,
          b2bPrice: created.b2bPrice,
        },
        statusCode: 201,
      });
      return created;
    });
  }

  async update(sku: string, data: UpdateProductDto, userId?: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.prisma.product.findUnique({ where: { sku } });
      if (!existing) throw new NotFoundException("Product not found");
      await this.ensureCategories(tx, data.categoryIds);
      const updated = await tx.product.update({
        where: { sku },
        data: {
          name: data.name,
          photoUrl: data.photoUrl,
          photoUrls: data.photoUrls,
          description: data.description,
          manufacturerRef: data.manufacturerRef,
          color: data.color,
          cost: data.cost,
          engravingCost: data.engravingCost,
          rrp: data.rrp,
          b2bPrice: data.b2bPrice,
          active: data.active,
          categories: data.categoryIds
            ? {
                deleteMany: {},
                create: data.categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              }
            : undefined,
        },
      });
      const priceChanged =
        data.cost !== undefined ||
        data.engravingCost !== undefined ||
        data.rrp !== undefined ||
        data.b2bPrice !== undefined;
      if (priceChanged) {
        await this.auditService.log({
          userId,
          method: "PUT",
          path: `/products/${sku}`,
          action: "price_change",
          entity: "product",
          entityId: sku,
          requestBody: {
            before: {
              cost: existing.cost,
              engravingCost: existing.engravingCost,
              rrp: existing.rrp,
              b2bPrice: existing.b2bPrice,
            },
            after: {
              cost: updated.cost,
              engravingCost: updated.engravingCost,
              rrp: updated.rrp,
              b2bPrice: updated.b2bPrice,
            },
          },
          statusCode: 200,
        });
      }
      return updated;
    });
  }

  async remove(sku: string, hard = false) {
    await this.getBySku(sku);
    if (hard) {
      return this.prisma.$transaction(async (tx) => {
        await tx.stockMoveLine.deleteMany({ where: { sku } });
        await tx.webOrderLine.deleteMany({ where: { sku } });
        await tx.productCategory.deleteMany({ where: { productSku: sku } });
        return tx.product.delete({ where: { sku } });
      });
    }
    return this.prisma.product.update({
      where: { sku },
      data: { active: false },
    });
  }

  async convertToStandard(sku: string, data: ConvertToStandardDto, userId?: number) {
    const product = await this.getBySku(sku);
    if (product.type !== "quick") {
      throw new BadRequestException("Product is already standard");
    }
    return this.prisma.$transaction(async (tx) => {
      await this.ensureCategories(tx, data.categoryIds);
      const updated = await tx.product.update({
        where: { sku },
        data: {
          type: "standard",
          name: data.name ?? product.name,
          photoUrl: data.photoUrl ?? product.photoUrl,
          photoUrls: data.photoUrls ?? product.photoUrls,
          description: data.description ?? product.description,
          manufacturerRef: data.manufacturerRef ?? product.manufacturerRef,
          color: data.color ?? product.color,
          cost: data.cost ?? product.cost,
          engravingCost: data.engravingCost ?? product.engravingCost,
          rrp: data.rrp ?? product.rrp,
          b2bPrice: data.b2bPrice ?? product.b2bPrice,
          active: data.active ?? product.active,
          categories: data.categoryIds
            ? {
                deleteMany: {},
                create: data.categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              }
            : undefined,
        },
      });
      const priceChanged =
        data.cost !== undefined ||
        data.engravingCost !== undefined ||
        data.rrp !== undefined ||
        data.b2bPrice !== undefined;
      if (priceChanged) {
        await this.auditService.log({
          userId,
          method: "POST",
          path: `/products/${sku}/convert-to-standard`,
          action: "price_change",
          entity: "product",
          entityId: sku,
          requestBody: {
            before: {
              cost: product.cost,
              engravingCost: product.engravingCost,
              rrp: product.rrp,
              b2bPrice: product.b2bPrice,
            },
            after: {
              cost: updated.cost,
              engravingCost: updated.engravingCost,
              rrp: updated.rrp,
              b2bPrice: updated.b2bPrice,
            },
          },
          statusCode: 200,
        });
      }
      return updated;
    });
  }

  private async ensureCategories(
    tx: Prisma.TransactionClient,
    categoryIds?: number[],
  ) {
    if (!categoryIds || categoryIds.length === 0) return;
    const uniqueIds = Array.from(new Set(categoryIds));
    const count = await tx.category.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      throw new BadRequestException("Some categories do not exist");
    }
  }
}
