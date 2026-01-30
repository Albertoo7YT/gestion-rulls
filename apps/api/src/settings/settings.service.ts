import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateWooSettingsDto } from "./dto/update-woo-settings.dto";
import { UpdateFiscalSettingsDto } from "./dto/update-fiscal-settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getSettings() {
    return this.prisma.settings.findUnique({ where: { id: 1 } });
  }

  async getWooSettings() {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });

    if (settings) {
      return settings;
    }

    return this.prisma.settings.create({
      data: {
        id: 1,
        wooSyncEnabled: true,
        wooStockWarehouseIds: [],
        lastWooSyncAt: null,
        wooBaseUrl: null,
        wooConsumerKey: null,
        wooConsumerSecret: null,
        wooSyncProducts: false,
        wooSyncImages: false,
      },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });
  }

  async updateWooSettings(data: UpdateWooSettingsDto) {
    if (data.wooStockWarehouseIds) {
      const uniqueIds = Array.from(new Set(data.wooStockWarehouseIds));
      if (uniqueIds.length > 0) {
        const count = await this.prisma.location.count({
          where: { id: { in: uniqueIds }, type: "warehouse", active: true },
        });
        if (count !== uniqueIds.length) {
          throw new BadRequestException(
            "All wooStockWarehouseIds must be warehouse locations",
          );
        }
      }
    }

    return this.prisma.settings.upsert({
      where: { id: 1 },
      update: {
        wooSyncEnabled: data.wooSyncEnabled,
        wooStockWarehouseIds: data.wooStockWarehouseIds,
        lastWooSyncAt: data.lastWooSyncAt
          ? new Date(data.lastWooSyncAt)
          : undefined,
        wooBaseUrl: data.wooBaseUrl,
        wooConsumerKey: data.wooConsumerKey,
        wooConsumerSecret: data.wooConsumerSecret,
        wooSyncProducts: data.wooSyncProducts,
        wooSyncImages: data.wooSyncImages,
      },
      create: {
        id: 1,
        wooSyncEnabled: data.wooSyncEnabled ?? true,
        wooStockWarehouseIds: data.wooStockWarehouseIds ?? [],
        lastWooSyncAt: data.lastWooSyncAt
          ? new Date(data.lastWooSyncAt)
          : null,
        wooBaseUrl: data.wooBaseUrl ?? null,
        wooConsumerKey: data.wooConsumerKey ?? null,
        wooConsumerSecret: data.wooConsumerSecret ?? null,
        wooSyncProducts: data.wooSyncProducts ?? false,
        wooSyncImages: data.wooSyncImages ?? false,
      },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });
  }

  async getFiscalSettings() {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        issuerName: true,
        issuerTaxId: true,
        issuerAddressLine1: true,
        issuerAddressLine2: true,
        issuerPostalCode: true,
        issuerCity: true,
        issuerProvince: true,
        issuerCountry: true,
        issuerEmail: true,
        issuerPhone: true,
      },
    });

    if (settings) {
      return settings;
    }

    return this.prisma.settings.create({
      data: {
        id: 1,
        wooSyncEnabled: true,
        wooStockWarehouseIds: [],
        issuerName: null,
        issuerTaxId: null,
        issuerAddressLine1: null,
        issuerAddressLine2: null,
        issuerPostalCode: null,
        issuerCity: null,
        issuerProvince: null,
        issuerCountry: null,
        issuerEmail: null,
        issuerPhone: null,
      },
      select: {
        issuerName: true,
        issuerTaxId: true,
        issuerAddressLine1: true,
        issuerAddressLine2: true,
        issuerPostalCode: true,
        issuerCity: true,
        issuerProvince: true,
        issuerCountry: true,
        issuerEmail: true,
        issuerPhone: true,
      },
    });
  }

  async updateFiscalSettings(data: UpdateFiscalSettingsDto) {
    return this.prisma.settings.upsert({
      where: { id: 1 },
      update: {
        issuerName: data.issuerName,
        issuerTaxId: data.issuerTaxId,
        issuerAddressLine1: data.issuerAddressLine1,
        issuerAddressLine2: data.issuerAddressLine2,
        issuerPostalCode: data.issuerPostalCode,
        issuerCity: data.issuerCity,
        issuerProvince: data.issuerProvince,
        issuerCountry: data.issuerCountry,
        issuerEmail: data.issuerEmail,
        issuerPhone: data.issuerPhone,
      },
      create: {
        id: 1,
        wooSyncEnabled: true,
        wooStockWarehouseIds: [],
        issuerName: data.issuerName ?? null,
        issuerTaxId: data.issuerTaxId ?? null,
        issuerAddressLine1: data.issuerAddressLine1 ?? null,
        issuerAddressLine2: data.issuerAddressLine2 ?? null,
        issuerPostalCode: data.issuerPostalCode ?? null,
        issuerCity: data.issuerCity ?? null,
        issuerProvince: data.issuerProvince ?? null,
        issuerCountry: data.issuerCountry ?? null,
        issuerEmail: data.issuerEmail ?? null,
        issuerPhone: data.issuerPhone ?? null,
      },
      select: {
        issuerName: true,
        issuerTaxId: true,
        issuerAddressLine1: true,
        issuerAddressLine2: true,
        issuerPostalCode: true,
        issuerCity: true,
        issuerProvince: true,
        issuerCountry: true,
        issuerEmail: true,
        issuerPhone: true,
      },
    });
  }

  async purgeData(targets: string[]) {
    const targetSet = new Set((targets ?? []).map((t) => t.trim()).filter(Boolean));
    if (targetSet.size === 0) {
      throw new BadRequestException("No targets selected");
    }

    const wants = (key: string) => targetSet.has(key);
    let deleteCustomers = wants("customers");
    let deleteCrm = wants("crm") || deleteCustomers;
    let deleteWeb = wants("web_orders") || deleteCustomers;
    let deleteStock = wants("stock_moves") || deleteCustomers;
    let deleteProducts = wants("products");
    let deleteCategories = wants("categories");
    let deleteSuppliers = wants("suppliers");
    let deletePurchase = wants("purchase_orders");
    let deletePriceRules = wants("price_rules");
    let deletePaymentMethods = wants("payment_methods");
    let deleteAccessories = wants("accessories");
    let deleteLocations = wants("locations");
    let deleteSeries = wants("document_series");
    let deleteSettings = wants("settings");
    let deleteUsers = wants("users");
    let deleteAudit = wants("audit_logs");
    let deleteCashClosures = wants("cash_closures");
    let deleteCategoriesLinks = deleteCategories || deleteProducts;
    let deleteWebLines = deleteWeb || deleteProducts;
    let deleteStockLines = deleteStock || deleteProducts;

    if (deleteLocations) {
      deleteStock = true;
      deleteStockLines = true;
    }
    if (deleteSuppliers) {
      deletePurchase = true;
    }
    if (deleteSuppliers && !deleteProducts) {
      // remove supplier links before deleting suppliers
      await this.prisma.product.updateMany({
        data: { supplierId: null },
      });
    }

    const summary: string[] = [];

    await this.prisma.$transaction(
      async (tx) => {
      if (deleteCrm) {
        await tx.crmAutomationRun.deleteMany();
        await tx.crmNotification.deleteMany();
        await tx.crmNote.deleteMany();
        await tx.crmTask.deleteMany();
        await tx.crmEvent.deleteMany();
        await tx.crmCustomerCard.deleteMany();
        await tx.crmCustomerStatus.deleteMany();
        await tx.crmPhase.deleteMany();
        await tx.crmTaskTemplate.deleteMany();
        await tx.crmSegment.deleteMany();
        await tx.crmAutomation.deleteMany();
        await tx.crmOpportunity.deleteMany();
        summary.push("crm");
      }

      if (deleteAudit) {
        await tx.auditLog.deleteMany();
        summary.push("audit_logs");
      }

      if (deleteWebLines) {
        await tx.webOrderLine.deleteMany();
      }
      if (deleteWeb) {
        await tx.webOrder.deleteMany();
        summary.push("web_orders");
      }

      if (deleteStockLines) {
        await tx.stockMoveLine.deleteMany();
      }
      if (deleteStock) {
        await tx.stockMove.deleteMany();
        summary.push("stock_moves");
      }

      if (deletePurchase) {
        await tx.purchaseOrderLine.deleteMany();
        await tx.purchaseOrder.deleteMany();
        summary.push("purchase_orders");
      }

      if (deletePriceRules) {
        await tx.priceRule.deleteMany();
        summary.push("price_rules");
      }

      if (deleteCategoriesLinks) {
        await tx.productCategory.deleteMany();
      }

      if (deleteProducts) {
        await tx.product.deleteMany();
        summary.push("products");
      }

      if (deleteCategories) {
        await tx.category.deleteMany();
        summary.push("categories");
      }

      if (deleteSuppliers) {
        await tx.supplier.deleteMany();
        summary.push("suppliers");
      }

      if (deleteCustomers) {
        await tx.customer.deleteMany();
        summary.push("customers");
      }

      if (deleteAccessories) {
        await tx.accessory.deleteMany();
        summary.push("accessories");
      }

      if (deleteLocations) {
        await tx.location.deleteMany();
        summary.push("locations");
      }

      if (deletePaymentMethods) {
        await tx.paymentMethod.deleteMany();
        summary.push("payment_methods");
      }

      if (deleteSeries) {
        await tx.documentSeries.deleteMany();
        summary.push("document_series");
      }

      if (deleteCashClosures) {
        await tx.cashClosure.deleteMany();
        summary.push("cash_closures");
      }

      if (deleteUsers) {
        if (!deleteCrm) {
          await tx.crmCustomerCard.updateMany({ data: { ownerId: null } });
          await tx.crmTask.updateMany({ data: { ownerId: null } });
          await tx.crmEvent.updateMany({ data: { ownerId: null } });
          await tx.crmNote.updateMany({ data: { ownerId: null } });
          await tx.crmOpportunity.updateMany({ data: { ownerId: null } });
          await tx.crmNotification.updateMany({ data: { ownerId: null } });
        }
        if (!deleteAudit) {
          await tx.auditLog.updateMany({ data: { userId: null } });
        }
        await tx.user.deleteMany();
        summary.push("users");
      }

      if (deleteSettings) {
        await tx.settings.deleteMany();
        summary.push("settings");
      }
      },
      { maxWait: 120000, timeout: 120000 },
    );

    return { deleted: summary };
  }
}
