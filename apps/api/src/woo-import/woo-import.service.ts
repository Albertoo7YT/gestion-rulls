import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, ProductType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WooImportDto } from "./dto/woo-import.dto";
import { WooExportStockDto } from "./dto/woo-export-stock.dto";
import { AuditService } from "../audit/audit.service";

type WooLineItem = {
  id: number;
  sku?: string;
  name?: string;
  quantity: number;
  price?: string;
  total?: string;
};

type WooOrder = {
  id: number;
  number: string;
  status: string;
  date_created: string;
  currency: string;
  total: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  line_items: WooLineItem[];
};

type WooProductImage = {
  src: string;
};

type WooProductCategory = {
  id: number;
  name?: string;
};

type WooProduct = {
  id: number;
  name: string;
  sku?: string;
  price?: string;
  regular_price?: string;
  images?: WooProductImage[];
  meta_data?: { key: string; value: unknown }[];
  categories?: WooProductCategory[];
};

@Injectable()
export class WooImportService {
  private readonly logger = new Logger(WooImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async importFromWoo(dto: WooImportDto) {
    const hasImportFlags =
      dto.importOrders ||
      dto.importProducts ||
      dto.importImages ||
      dto.importPrices ||
      dto.importCategories;
    const importOrders = hasImportFlags ? dto.importOrders === true : true;
    const importProducts =
      dto.importProducts === true ||
      dto.importImages === true ||
      dto.importPrices === true ||
      dto.importCategories === true;

    try {
      const results: Record<string, unknown> = {};
      if (importOrders) {
        results.orders = await this.importOrders(dto);
      }
      if (importProducts) {
        results.products = await this.syncProducts(dto);
      }
      await this.auditService.log({
        method: "POST",
        path: "/woo/import",
        action: "woo_import",
        entity: "Woo",
        requestBody: dto,
        responseBody: results,
        statusCode: 200,
      });
      return results;
    } catch (error) {
      await this.auditService.log({
        method: "POST",
        path: "/woo/import",
        action: "woo_import_error",
        entity: "Woo",
        requestBody: dto,
        responseBody: { error: String(error) },
        statusCode: 500,
      });
      throw error;
    }
  }

  async importOrders(dto: WooImportDto) {
    let importWarehouseId: number | undefined;
    if (dto.importWarehouseId) {
      const warehouse = await this.prisma.location.findFirst({
        where: { id: dto.importWarehouseId, type: "warehouse", active: true },
        select: { id: true },
      });
      if (!warehouse) {
        throw new BadRequestException(
          "Import warehouse not found or not warehouse",
        );
      }
      importWarehouseId = warehouse.id;
    }

    const orders = await this.fetchOrders(dto.includePending === true);
    const results = [];

    for (const order of orders) {
      const result = await this.prisma.$transaction(async (tx) => {
        const wooOrderId = String(order.id);
        const existing = await tx.webOrder.findUnique({
          where: { wooOrderId },
        });

        if (existing) {
          const updated = await tx.webOrder.update({
            where: { wooOrderId },
            data: { status: order.status },
          });
          return { wooOrderId, action: "updated", status: updated.status };
        }

        const warnings: string[] = [];
        const linesData = [];

        for (const line of order.line_items ?? []) {
          let sku = (line.sku ?? "").trim();
          if (!sku) {
            const quick = await this.createQuickProduct(tx, line.name);
            sku = quick.sku;
            warnings.push(`Line ${line.id} missing SKU, created ${sku}`);
          } else {
            const product = await tx.product.findUnique({ where: { sku } });
            if (!product) {
              const quick = await this.createQuickProduct(tx, line.name);
              warnings.push(`SKU ${sku} not found, created ${quick.sku}`);
              sku = quick.sku;
            }
          }

          const qty = line.quantity ?? 0;
          const total = line.total ?? "0";
          const price =
            line.price ??
            (qty > 0 ? (Number(total) / qty).toFixed(2) : "0");

          linesData.push({
            sku,
            qty,
            price,
            lineTotal: total,
          });
        }

        const customerName = `${order.billing?.first_name ?? ""} ${
          order.billing?.last_name ?? ""
        }`.trim();

        const created = await tx.webOrder.create({
          data: {
            wooOrderId,
            number: order.number,
            status: order.status,
            createdAtWoo: new Date(order.date_created),
            customerName: customerName || "N/A",
            email: order.billing?.email ?? "unknown@example.com",
            total: order.total,
            currency: order.currency,
            importedAt: new Date(),
            assignedWarehouseId: importWarehouseId,
            notes: warnings.length > 0 ? warnings.join(" | ") : null,
            lines: { create: linesData },
          },
        });

        if (warnings.length > 0) {
          warnings.forEach((msg) =>
            this.logger.warn(`[${wooOrderId}] ${msg}`),
          );
        }

        return {
          wooOrderId,
          action: "created",
          status: created.status,
          warnings,
        };
      });

      results.push(result);
    }

    this.logger.log(`Imported ${results.length} orders`);
    return { imported: results.length, results };
  }

  private async fetchOrders(includePending: boolean): Promise<WooOrder[]> {
    const { baseUrl, key, secret } = await this.getWooConfig();

    if (!baseUrl || !key || !secret) {
      return this.getMockOrders(includePending);
    }

    const url = new URL("/wp-json/wc/v3/orders", baseUrl);
    const statuses = ["processing", "on-hold"];
    if (includePending) statuses.push("pending");
    url.searchParams.set("status", statuses.join(","));
    url.searchParams.set("per_page", "100");
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Woo API error: ${res.status}`);
    }

    return (await res.json()) as WooOrder[];
  }

  async syncProducts(options?: WooImportDto) {
    const { baseUrl, key, secret, syncProducts, syncImages } =
      await this.getWooConfig();
    const allowProducts = options?.importProducts ?? syncProducts;
    const allowImages = options?.importImages ?? syncImages;
    const allowPrices = options?.importPrices ?? false;
    const allowCategories = options?.importCategories ?? false;

    if (!baseUrl || !key || !secret) {
      return { imported: 0, updated: 0, skipped: 0, message: "No credentials" };
    }

    if (!allowProducts && !allowImages && !allowPrices && !allowCategories) {
      return { imported: 0, updated: 0, skipped: 0, message: "Sync disabled" };
    }

    const products = await this.fetchProducts(baseUrl, key, secret);
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const product of products) {
      const sku = (product.sku ?? "").trim();
      if (!sku) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.product.findUnique({ where: { sku } });
      const photoUrls = (product.images ?? [])
        .map((img) => img.src)
        .filter((src) => src);
      const photoUrl = photoUrls[0];
      const priceValue = product.price ?? product.regular_price;
      const costValue = this.getWooMetaValue(product.meta_data, [
        "cost_price",
        "cost",
        "_wc_cog_cost",
      ]);
      const categoryIds = allowProducts || allowCategories
        ? await this.getCategoryIdsFromWoo(product.categories ?? [])
        : [];

      if (!existing) {
        if (!allowProducts) {
          skipped += 1;
          continue;
        }
        await this.prisma.product.create({
          data: {
            sku,
            name: product.name?.trim() || sku,
            type: ProductType.standard,
            active: true,
            photoUrl: allowImages ? photoUrl : undefined,
            photoUrls: allowImages ? photoUrls : undefined,
            rrp: allowPrices && priceValue ? priceValue : undefined,
            cost: allowPrices && costValue ? costValue : undefined,
            categories:
              categoryIds.length > 0
                ? { create: categoryIds.map((id) => ({ categoryId: id })) }
                : undefined,
          },
        });
        imported += 1;
        continue;
      }

      const data: Prisma.ProductUpdateInput = {};
      if (allowProducts) {
        data.name = product.name?.trim() || existing.name;
      }
      if (allowImages) {
        data.photoUrl = photoUrl ?? null;
        data.photoUrls = photoUrls.length ? photoUrls : [];
      }
      if (allowPrices) {
        if (priceValue) data.rrp = priceValue;
        if (costValue) data.cost = costValue;
      }
      if ((allowProducts || allowCategories) && categoryIds.length > 0) {
        data.categories = {
          deleteMany: {},
          createMany: { data: categoryIds.map((id) => ({ categoryId: id })) },
        };
      }
      if (Object.keys(data).length === 0) {
        skipped += 1;
        continue;
      }
      await this.prisma.product.update({ where: { sku }, data });
      updated += 1;
    }

    return { imported, updated, skipped };
  }

  async exportStock(dto: WooExportStockDto) {
    try {
      const { baseUrl, key, secret } = await this.getWooConfig();
      if (!baseUrl || !key || !secret) {
        return { updated: 0, skipped: 0, message: "No credentials" };
      }

      const warehouseIds =
        dto.warehouseIds?.length && dto.warehouseIds.length > 0
          ? dto.warehouseIds
          : await this.getWarehouseIdsFromSettings();

      if (!warehouseIds.length) {
        throw new BadRequestException("No warehouse ids provided");
      }

      const count = await this.prisma.location.count({
        where: { id: { in: warehouseIds }, type: "warehouse", active: true },
      });
      if (count !== warehouseIds.length) {
        throw new BadRequestException("All warehouse ids must be warehouses");
      }

      const rows = await this.prisma.$queryRaw<
        { sku: string; quantity: number }[]
      >`
        SELECT p."sku",
               CAST(COALESCE(inc.in_qty, 0) - COALESCE(outg.out_qty, 0) AS INTEGER) AS quantity
        FROM "Product" p
        LEFT JOIN (
          SELECT l."sku", SUM(l."quantity") AS in_qty
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          WHERE m."toId" IN (${Prisma.join(warehouseIds)})
          GROUP BY l."sku"
        ) inc ON inc."sku" = p."sku"
        LEFT JOIN (
          SELECT l."sku", SUM(l."quantity") AS out_qty
          FROM "StockMoveLine" l
          JOIN "StockMove" m ON m."id" = l."moveId"
          WHERE m."fromId" IN (${Prisma.join(warehouseIds)})
          GROUP BY l."sku"
        ) outg ON outg."sku" = p."sku"
        WHERE p."active" = true
        ORDER BY p."sku" ASC
      `;

      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        const sku = row.sku;
        const productId = await this.findWooProductId(
          baseUrl,
          key,
          secret,
          sku,
        );
        if (!productId) {
          skipped += 1;
          continue;
        }
        await this.updateWooStock(baseUrl, key, secret, productId, row.quantity);
        updated += 1;
      }

      const result = { updated, skipped };
      await this.auditService.log({
        method: "POST",
        path: "/woo/export-stock",
        action: "woo_export_stock",
        entity: "Woo",
        requestBody: dto,
        responseBody: result,
        statusCode: 200,
      });
      return result;
    } catch (error) {
      await this.auditService.log({
        method: "POST",
        path: "/woo/export-stock",
        action: "woo_export_stock_error",
        entity: "Woo",
        requestBody: dto,
        responseBody: { error: String(error) },
        statusCode: 500,
      });
      throw error;
    }
  }

  async testConnection() {
    const { baseUrl, key, secret } = await this.getWooConfig();
    if (!baseUrl || !key || !secret) {
      return { ok: false, message: "Missing Woo credentials" };
    }

    const url = new URL("/wp-json/wc/v3/system_status", baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return { ok: false, message: `Woo API error: ${res.status}` };
    }

    return { ok: true, message: "Connection OK" };
  }

  private async fetchProducts(baseUrl: string, key: string, secret: string) {
    const url = new URL("/wp-json/wc/v3/products", baseUrl);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Woo products error: ${res.status}`);
    }
    return (await res.json()) as WooProduct[];
  }

  private getWooMetaValue(
    meta: { key: string; value: unknown }[] | undefined,
    keys: string[],
  ) {
    if (!meta?.length) return undefined;
    const found = meta.find((item) => keys.includes(item.key));
    if (!found) return undefined;
    const value = typeof found.value === "string" ? found.value : undefined;
    return value && value.trim() ? value : undefined;
  }

  private async getCategoryIdsFromWoo(categories: WooProductCategory[]) {
    const ids: number[] = [];
    const seen = new Set<string>();
    for (const category of categories) {
      const name = (category.name ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const existing = await this.prisma.category.findUnique({
        where: { name },
      });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const created = await this.prisma.category.create({ data: { name } });
      ids.push(created.id);
    }
    return ids;
  }

  private async getWooConfig() {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });

    const baseUrl =
      settings?.wooBaseUrl || this.config.get<string>("WOO_BASE_URL");
    const key =
      settings?.wooConsumerKey || this.config.get<string>("WOO_CONSUMER_KEY");
    const secret =
      settings?.wooConsumerSecret ||
      this.config.get<string>("WOO_CONSUMER_SECRET");

    return {
      baseUrl,
      key,
      secret,
      syncProducts: settings?.wooSyncProducts ?? false,
      syncImages: settings?.wooSyncImages ?? false,
    };
  }

  private async getWarehouseIdsFromSettings() {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: { wooStockWarehouseIds: true },
    });
    if (!settings) return [];
    const ids = settings.wooStockWarehouseIds as number[] | null;
    return Array.isArray(ids) ? ids : [];
  }

  private async findWooProductId(
    baseUrl: string,
    key: string,
    secret: string,
    sku: string,
  ) {
    const url = new URL("/wp-json/wc/v3/products", baseUrl);
    url.searchParams.set("sku", sku);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);

    const res = await fetch(url.toString());
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as WooProduct[];
    return data?.[0]?.id ?? null;
  }

  private async updateWooStock(
    baseUrl: string,
    key: string,
    secret: string,
    productId: number,
    quantity: number,
  ) {
    const url = new URL(`/wp-json/wc/v3/products/${productId}`, baseUrl);
    url.searchParams.set("consumer_key", key);
    url.searchParams.set("consumer_secret", secret);

    const res = await fetch(url.toString(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manage_stock: true,
        stock_quantity: quantity,
        stock_status: quantity > 0 ? "instock" : "outofstock",
      }),
    });
    if (!res.ok) {
      throw new Error(`Woo stock update error: ${res.status}`);
    }
  }

  private getMockOrders(includePending: boolean): WooOrder[] {
    const status = includePending ? "pending" : "processing";
    return [
      {
        id: 9001,
        number: "9001",
        status,
        date_created: new Date().toISOString(),
        currency: "EUR",
        total: "39.99",
        billing: {
          first_name: "Cliente",
          last_name: "Demo",
          email: "cliente@example.com",
        },
        line_items: [
          {
            id: 1,
            sku: "",
            name: "Producto Woo",
            quantity: 2,
            price: "19.99",
            total: "39.98",
          },
        ],
      },
    ];
  }

  private async createQuickProduct(
    tx: Prisma.TransactionClient,
    name?: string,
  ) {
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

    return tx.product.create({
      data: {
        sku,
        name: name?.trim() || "Producto Woo",
        type: ProductType.quick,
        active: true,
      },
    });
  }
}
