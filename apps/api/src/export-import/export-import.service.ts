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
      customers,
      users,
      auditLogs,
      products,
      categories,
      productCategories,
      suppliers,
      priceRules,
      paymentMethods,
      purchaseOrders,
      purchaseOrderLines,
      locations,
      stockMoves,
      stockMoveLines,
      accessories,
      documentSeries,
      webOrders,
      webOrderLines,
      settings,
      crmPhases,
      crmStatuses,
      crmCards,
      crmTasks,
      crmNotes,
      crmEvents,
      crmTaskTemplates,
      crmSegments,
      crmAutomations,
      crmAutomationRuns,
      crmNotifications,
      crmOpportunities,
      cashClosures,
    ] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        select: {
          id: true,
          type: true,
          name: true,
          taxId: true,
          addressLine1: true,
          addressLine2: true,
          postalCode: true,
          province: true,
          city: true,
          country: true,
          email: true,
          phone: true,
          notes: true,
          active: true,
          createdAt: true,
        },
      }),
      this.prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          passwordHash: true,
          role: true,
          active: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        select: {
          id: true,
          userId: true,
          method: true,
          path: true,
          action: true,
          entity: true,
          entityId: true,
          requestBody: true,
          responseBody: true,
          statusCode: true,
          createdAt: true,
        },
      }),
      this.prisma.product.findMany({
        select: {
          sku: true,
          name: true,
          type: true,
          photoUrl: true,
          photoUrls: true,
          description: true,
          manufacturerRef: true,
          color: true,
          cost: true,
          engravingCost: true,
          rrp: true,
          b2bPrice: true,
          active: true,
          supplierId: true,
        },
      }),
      this.prisma.category.findMany(),
      this.prisma.productCategory.findMany(),
      this.prisma.supplier.findMany(),
      this.prisma.priceRule.findMany(),
      this.prisma.paymentMethod.findMany(),
      this.prisma.purchaseOrder.findMany(),
      this.prisma.purchaseOrderLine.findMany(),
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
          seriesCode: true,
          seriesYear: true,
          seriesNumber: true,
          reference: true,
          notes: true,
          paymentStatus: true,
          paidAmount: true,
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
          addOnCost: true,
          addOnPrice: true,
          addOns: true,
        },
      }),
      this.prisma.accessory.findMany({
        select: {
          id: true,
          name: true,
          cost: true,
          price: true,
          active: true,
          createdAt: true,
        },
      }),
      this.prisma.documentSeries.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          scope: true,
          prefix: true,
          year: true,
          nextNumber: true,
          padding: true,
          active: true,
          createdAt: true,
          updatedAt: true,
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
          customerId: true,
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
          wooBaseUrl: true,
          wooConsumerKey: true,
          wooConsumerSecret: true,
          wooSyncProducts: true,
          wooSyncImages: true,
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
      }),
      this.prisma.crmPhase.findMany(),
      this.prisma.crmCustomerStatus.findMany(),
      this.prisma.crmCustomerCard.findMany(),
      this.prisma.crmTask.findMany(),
      this.prisma.crmNote.findMany(),
      this.prisma.crmEvent.findMany(),
      this.prisma.crmTaskTemplate.findMany(),
      this.prisma.crmSegment.findMany(),
      this.prisma.crmAutomation.findMany(),
      this.prisma.crmAutomationRun.findMany(),
      this.prisma.crmNotification.findMany(),
      this.prisma.crmOpportunity.findMany(),
      this.prisma.cashClosure.findMany(),
    ]);

    const manifest: ExportManifest = {
      version: EXPORT_VERSION,
      createdAt: new Date().toISOString(),
    };

    const payload = {
      manifest,
      customers,
      users,
      audit_logs: auditLogs,
      products,
      categories,
      product_categories: productCategories,
      suppliers,
      price_rules: priceRules,
      payment_methods: paymentMethods,
      purchase_orders: purchaseOrders,
      purchase_order_lines: purchaseOrderLines,
      locations,
      stock_moves: stockMoves,
      stock_move_lines: stockMoveLines,
      accessories,
      document_series: documentSeries,
      web_orders: webOrders,
      web_order_lines: webOrderLines,
      settings,
      crm_phases: crmPhases,
      crm_statuses: crmStatuses,
      crm_cards: crmCards,
      crm_tasks: crmTasks,
      crm_notes: crmNotes,
      crm_events: crmEvents,
      crm_task_templates: crmTaskTemplates,
      crm_segments: crmSegments,
      crm_automations: crmAutomations,
      crm_automation_runs: crmAutomationRuns,
      crm_notifications: crmNotifications,
      crm_opportunities: crmOpportunities,
      cash_closures: cashClosures,
    };

    this.logger.log(
      `Export built: customers=${customers.length}, users=${users.length}, products=${products.length}, locations=${locations.length}, moves=${stockMoves.length}, orders=${webOrders.length}, accessories=${accessories.length}, series=${documentSeries.length}, crm_cards=${crmCards.length}`,
    );

    return payload;
  }

  async importData(
    data: {
      manifest: ExportManifest;
      customers: Prisma.CustomerCreateManyInput[];
      users: Prisma.UserCreateManyInput[];
      audit_logs: Prisma.AuditLogCreateManyInput[];
      products: Prisma.ProductCreateManyInput[];
      categories: Prisma.CategoryCreateManyInput[];
      product_categories: Prisma.ProductCategoryCreateManyInput[];
      suppliers: Prisma.SupplierCreateManyInput[];
      price_rules: Prisma.PriceRuleCreateManyInput[];
      payment_methods: Prisma.PaymentMethodCreateManyInput[];
      purchase_orders: Prisma.PurchaseOrderCreateManyInput[];
      purchase_order_lines: Prisma.PurchaseOrderLineCreateManyInput[];
      locations: Prisma.LocationCreateManyInput[];
      stock_moves: Prisma.StockMoveCreateManyInput[];
      stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
      accessories: Prisma.AccessoryCreateManyInput[];
      document_series: Prisma.DocumentSeriesCreateManyInput[];
      web_orders: Prisma.WebOrderCreateManyInput[];
      web_order_lines: Prisma.WebOrderLineCreateManyInput[];
      settings: Prisma.SettingsCreateManyInput[];
      crm_phases: Prisma.CrmPhaseCreateManyInput[];
      crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
      crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
      crm_tasks: Prisma.CrmTaskCreateManyInput[];
      crm_notes: Prisma.CrmNoteCreateManyInput[];
      crm_events: Prisma.CrmEventCreateManyInput[];
      crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
      crm_segments: Prisma.CrmSegmentCreateManyInput[];
      crm_automations: Prisma.CrmAutomationCreateManyInput[];
      crm_automation_runs: Prisma.CrmAutomationRunCreateManyInput[];
      crm_notifications: Prisma.CrmNotificationCreateManyInput[];
      crm_opportunities: Prisma.CrmOpportunityCreateManyInput[];
      cash_closures: Prisma.CashClosureCreateManyInput[];
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
    customers: Prisma.CustomerCreateManyInput[];
    users: Prisma.UserCreateManyInput[];
    audit_logs: Prisma.AuditLogCreateManyInput[];
    products: Prisma.ProductCreateManyInput[];
    categories: Prisma.CategoryCreateManyInput[];
    product_categories: Prisma.ProductCategoryCreateManyInput[];
    suppliers: Prisma.SupplierCreateManyInput[];
    price_rules: Prisma.PriceRuleCreateManyInput[];
    payment_methods: Prisma.PaymentMethodCreateManyInput[];
    purchase_orders: Prisma.PurchaseOrderCreateManyInput[];
    purchase_order_lines: Prisma.PurchaseOrderLineCreateManyInput[];
    locations: Prisma.LocationCreateManyInput[];
    stock_moves: Prisma.StockMoveCreateManyInput[];
    stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
    accessories: Prisma.AccessoryCreateManyInput[];
    document_series: Prisma.DocumentSeriesCreateManyInput[];
    web_orders: Prisma.WebOrderCreateManyInput[];
    web_order_lines: Prisma.WebOrderLineCreateManyInput[];
    settings: Prisma.SettingsCreateManyInput[];
    crm_phases: Prisma.CrmPhaseCreateManyInput[];
    crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
    crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
    crm_tasks: Prisma.CrmTaskCreateManyInput[];
    crm_notes: Prisma.CrmNoteCreateManyInput[];
    crm_events: Prisma.CrmEventCreateManyInput[];
    crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
    crm_segments: Prisma.CrmSegmentCreateManyInput[];
    crm_automations: Prisma.CrmAutomationCreateManyInput[];
    crm_automation_runs: Prisma.CrmAutomationRunCreateManyInput[];
    crm_notifications: Prisma.CrmNotificationCreateManyInput[];
    crm_opportunities: Prisma.CrmOpportunityCreateManyInput[];
    cash_closures: Prisma.CashClosureCreateManyInput[];
  }) {
    await this.prisma.auditLog.deleteMany();
    await this.prisma.$transaction(async (tx) => {
      await this.restoreAllTx(tx, data);
    });
    await this.importAuditLogs(data.audit_logs);
  }

  async verifyRestore(data: {
    manifest: ExportManifest;
    customers: Prisma.CustomerCreateManyInput[];
    users: Prisma.UserCreateManyInput[];
    audit_logs: Prisma.AuditLogCreateManyInput[];
    products: Prisma.ProductCreateManyInput[];
    categories: Prisma.CategoryCreateManyInput[];
    product_categories: Prisma.ProductCategoryCreateManyInput[];
    suppliers: Prisma.SupplierCreateManyInput[];
    price_rules: Prisma.PriceRuleCreateManyInput[];
    payment_methods: Prisma.PaymentMethodCreateManyInput[];
    purchase_orders: Prisma.PurchaseOrderCreateManyInput[];
    purchase_order_lines: Prisma.PurchaseOrderLineCreateManyInput[];
    locations: Prisma.LocationCreateManyInput[];
    stock_moves: Prisma.StockMoveCreateManyInput[];
    stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
    accessories: Prisma.AccessoryCreateManyInput[];
    document_series: Prisma.DocumentSeriesCreateManyInput[];
    web_orders: Prisma.WebOrderCreateManyInput[];
    web_order_lines: Prisma.WebOrderLineCreateManyInput[];
    settings: Prisma.SettingsCreateManyInput[];
    crm_phases: Prisma.CrmPhaseCreateManyInput[];
    crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
    crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
    crm_tasks: Prisma.CrmTaskCreateManyInput[];
    crm_notes: Prisma.CrmNoteCreateManyInput[];
    crm_events: Prisma.CrmEventCreateManyInput[];
    crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
    crm_segments: Prisma.CrmSegmentCreateManyInput[];
    crm_automations: Prisma.CrmAutomationCreateManyInput[];
    crm_automation_runs: Prisma.CrmAutomationRunCreateManyInput[];
    crm_notifications: Prisma.CrmNotificationCreateManyInput[];
    crm_opportunities: Prisma.CrmOpportunityCreateManyInput[];
    cash_closures: Prisma.CashClosureCreateManyInput[];
  }) {
    this.validateManifest(data.manifest);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.restoreAllTx(tx, data);
        throw new Error("VERIFY_RESTORE_ROLLBACK");
      });
    } catch (err) {
      if (String(err).includes("VERIFY_RESTORE_ROLLBACK")) {
        return { verified: true };
      }
      throw err;
    }
  }

  private async restoreAllTx(
    tx: Prisma.TransactionClient,
    data: {
      customers: Prisma.CustomerCreateManyInput[];
      users: Prisma.UserCreateManyInput[];
      audit_logs: Prisma.AuditLogCreateManyInput[];
      products: Prisma.ProductCreateManyInput[];
      categories: Prisma.CategoryCreateManyInput[];
      product_categories: Prisma.ProductCategoryCreateManyInput[];
      suppliers: Prisma.SupplierCreateManyInput[];
      price_rules: Prisma.PriceRuleCreateManyInput[];
      payment_methods: Prisma.PaymentMethodCreateManyInput[];
      purchase_orders: Prisma.PurchaseOrderCreateManyInput[];
      purchase_order_lines: Prisma.PurchaseOrderLineCreateManyInput[];
      locations: Prisma.LocationCreateManyInput[];
      stock_moves: Prisma.StockMoveCreateManyInput[];
      stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
      accessories: Prisma.AccessoryCreateManyInput[];
      document_series: Prisma.DocumentSeriesCreateManyInput[];
      web_orders: Prisma.WebOrderCreateManyInput[];
      web_order_lines: Prisma.WebOrderLineCreateManyInput[];
      settings: Prisma.SettingsCreateManyInput[];
      crm_phases: Prisma.CrmPhaseCreateManyInput[];
      crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
      crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
      crm_tasks: Prisma.CrmTaskCreateManyInput[];
      crm_notes: Prisma.CrmNoteCreateManyInput[];
      crm_events: Prisma.CrmEventCreateManyInput[];
      crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
      crm_segments: Prisma.CrmSegmentCreateManyInput[];
      crm_automations: Prisma.CrmAutomationCreateManyInput[];
      crm_automation_runs: Prisma.CrmAutomationRunCreateManyInput[];
      crm_notifications: Prisma.CrmNotificationCreateManyInput[];
      crm_opportunities: Prisma.CrmOpportunityCreateManyInput[];
      cash_closures: Prisma.CashClosureCreateManyInput[];
    },
  ) {
    const validUserIds = new Set(
      (await tx.user.findMany({ select: { id: true } })).map((u) => u.id),
    );
    const normalizeOwner = (ownerId?: number | null) =>
      ownerId && validUserIds.has(ownerId) ? ownerId : null;

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
    await tx.stockMoveLine.deleteMany();
    await tx.stockMove.deleteMany();
    await tx.webOrderLine.deleteMany();
    await tx.webOrder.deleteMany();
    await tx.purchaseOrderLine.deleteMany();
    await tx.purchaseOrder.deleteMany();
    await tx.priceRule.deleteMany();
    await tx.productCategory.deleteMany();
    await tx.product.deleteMany();
    await tx.category.deleteMany();
    await tx.supplier.deleteMany();
    await tx.customer.deleteMany();
    await tx.user.deleteMany();
    await tx.location.deleteMany();
    await tx.accessory.deleteMany();
    await tx.documentSeries.deleteMany();
    await tx.settings.deleteMany();
    await tx.paymentMethod.deleteMany();
    await tx.cashClosure.deleteMany();

    if (data.locations.length > 0) {
      await tx.location.createMany({ data: data.locations });
    }
    if (data.categories.length > 0) {
      await tx.category.createMany({ data: data.categories });
    }
    if (data.suppliers.length > 0) {
      await tx.supplier.createMany({ data: data.suppliers });
    }
    if (data.products.length > 0) {
      await tx.product.createMany({ data: data.products });
    }
    if (data.product_categories.length > 0) {
      await tx.productCategory.createMany({ data: data.product_categories });
    }
    if (data.price_rules.length > 0) {
      await tx.priceRule.createMany({ data: data.price_rules });
    }
    if (data.payment_methods.length > 0) {
      await tx.paymentMethod.createMany({ data: data.payment_methods });
    }
    if (data.customers.length > 0) {
      await tx.customer.createMany({ data: data.customers });
    }
    if (data.users.length > 0) {
      await tx.user.createMany({ data: data.users });
    }
    if (data.accessories.length > 0) {
      await tx.accessory.createMany({ data: data.accessories });
    }
    if (data.document_series.length > 0) {
      await tx.documentSeries.createMany({ data: data.document_series });
    }
    if (data.settings.length > 0) {
      await tx.settings.createMany({ data: data.settings });
    }
    if (data.purchase_orders.length > 0) {
      await tx.purchaseOrder.createMany({ data: data.purchase_orders });
    }
    if (data.purchase_order_lines.length > 0) {
      await tx.purchaseOrderLine.createMany({ data: data.purchase_order_lines });
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
    if (data.crm_phases.length > 0) {
      await tx.crmPhase.createMany({ data: data.crm_phases });
    }
    if (data.crm_statuses.length > 0) {
      await tx.crmCustomerStatus.createMany({ data: data.crm_statuses });
    }
    if (data.crm_opportunities.length > 0) {
      await tx.crmOpportunity.createMany({
        data: data.crm_opportunities.map((opportunity) => ({
          ...opportunity,
          ownerId: normalizeOwner(opportunity.ownerId ?? null),
        })),
      });
    }
    if (data.crm_cards.length > 0) {
      await tx.crmCustomerCard.createMany({
        data: data.crm_cards.map((card) => ({
          ...card,
          ownerId: normalizeOwner(card.ownerId ?? null),
        })),
      });
    }
    if (data.crm_task_templates.length > 0) {
      await tx.crmTaskTemplate.createMany({ data: data.crm_task_templates });
    }
    if (data.crm_segments.length > 0) {
      await tx.crmSegment.createMany({ data: data.crm_segments });
    }
    if (data.crm_automations.length > 0) {
      await tx.crmAutomation.createMany({ data: data.crm_automations });
    }
    if (data.crm_automation_runs.length > 0) {
      await tx.crmAutomationRun.createMany({ data: data.crm_automation_runs });
    }
    if (data.crm_tasks.length > 0) {
      await tx.crmTask.createMany({
        data: data.crm_tasks.map((task) => ({
          ...task,
          ownerId: normalizeOwner(task.ownerId ?? null),
        })),
      });
    }
    if (data.crm_notes.length > 0) {
      await tx.crmNote.createMany({
        data: data.crm_notes.map((note) => ({
          ...note,
          ownerId: normalizeOwner(note.ownerId ?? null),
        })),
      });
    }
    if (data.crm_events.length > 0) {
      await tx.crmEvent.createMany({
        data: data.crm_events.map((event) => ({
          ...event,
          ownerId: normalizeOwner(event.ownerId ?? null),
        })),
      });
    }
    if (data.crm_notifications.length > 0) {
      await tx.crmNotification.createMany({
        data: data.crm_notifications.map((notification) => ({
          ...notification,
          ownerId: normalizeOwner(notification.ownerId ?? null),
        })),
      });
    }
    if (data.cash_closures.length > 0) {
      await tx.cashClosure.createMany({ data: data.cash_closures });
    }
  }

  private async mergeAll(data: {
    customers: Prisma.CustomerCreateManyInput[];
    users: Prisma.UserCreateManyInput[];
    audit_logs: Prisma.AuditLogCreateManyInput[];
    products: Prisma.ProductCreateManyInput[];
    categories: Prisma.CategoryCreateManyInput[];
    product_categories: Prisma.ProductCategoryCreateManyInput[];
    suppliers: Prisma.SupplierCreateManyInput[];
    price_rules: Prisma.PriceRuleCreateManyInput[];
    payment_methods: Prisma.PaymentMethodCreateManyInput[];
    purchase_orders: Prisma.PurchaseOrderCreateManyInput[];
    purchase_order_lines: Prisma.PurchaseOrderLineCreateManyInput[];
    locations: Prisma.LocationCreateManyInput[];
    stock_moves: Prisma.StockMoveCreateManyInput[];
    stock_move_lines: Prisma.StockMoveLineCreateManyInput[];
    accessories: Prisma.AccessoryCreateManyInput[];
    document_series: Prisma.DocumentSeriesCreateManyInput[];
    web_orders: Prisma.WebOrderCreateManyInput[];
    web_order_lines: Prisma.WebOrderLineCreateManyInput[];
    settings: Prisma.SettingsCreateManyInput[];
    crm_phases: Prisma.CrmPhaseCreateManyInput[];
    crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
    crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
    crm_tasks: Prisma.CrmTaskCreateManyInput[];
    crm_notes: Prisma.CrmNoteCreateManyInput[];
    crm_events: Prisma.CrmEventCreateManyInput[];
    crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
    crm_segments: Prisma.CrmSegmentCreateManyInput[];
    crm_automations: Prisma.CrmAutomationCreateManyInput[];
    crm_automation_runs: Prisma.CrmAutomationRunCreateManyInput[];
    crm_notifications: Prisma.CrmNotificationCreateManyInput[];
    crm_opportunities: Prisma.CrmOpportunityCreateManyInput[];
    cash_closures: Prisma.CashClosureCreateManyInput[];
  }) {
    await this.prisma.$transaction(
      async (tx) => {
      const validUserIds = new Set(
        (await tx.user.findMany({ select: { id: true } })).map((u) => u.id),
      );

      const normalizeOwner = (ownerId?: number | null) =>
        ownerId && validUserIds.has(ownerId) ? ownerId : null;

      for (const loc of data.locations) {
        await tx.location.upsert({
          where: { id: loc.id },
          update: { ...loc },
          create: { ...loc },
        });
      }

      for (const category of data.categories) {
        await tx.category.upsert({
          where: { id: category.id },
          update: { ...category },
          create: { ...category },
        });
      }

      for (const supplier of data.suppliers) {
        await tx.supplier.upsert({
          where: { id: supplier.id },
          update: { ...supplier },
          create: { ...supplier },
        });
      }

      for (const customer of data.customers) {
        await tx.customer.upsert({
          where: { id: customer.id },
          update: { ...customer },
          create: { ...customer },
        });
      }

      for (const user of data.users) {
        await tx.user.upsert({
          where: { id: user.id },
          update: { ...user },
          create: { ...user },
        });
      }

      for (const prod of data.products) {
        await tx.product.upsert({
          where: { sku: prod.sku },
          update: { ...prod },
          create: { ...prod },
        });
      }

      for (const link of data.product_categories) {
        await tx.productCategory.upsert({
          where: {
            productSku_categoryId: {
              productSku: link.productSku,
              categoryId: link.categoryId,
            },
          },
          update: { ...link },
          create: { ...link },
        });
      }

      for (const rule of data.price_rules) {
        await tx.priceRule.upsert({
          where: { id: rule.id },
          update: { ...rule },
          create: { ...rule },
        });
      }

      for (const method of data.payment_methods) {
        await tx.paymentMethod.upsert({
          where: { id: method.id },
          update: { ...method },
          create: { ...method },
        });
      }

      for (const po of data.purchase_orders) {
        await tx.purchaseOrder.upsert({
          where: { id: po.id },
          update: { ...po },
          create: { ...po },
        });
      }

      for (const line of data.purchase_order_lines) {
        await tx.purchaseOrderLine.upsert({
          where: { id: line.id },
          update: { ...line },
          create: { ...line },
        });
      }

      for (const accessory of data.accessories) {
        await tx.accessory.upsert({
          where: { id: accessory.id },
          update: { ...accessory },
          create: { ...accessory },
        });
      }

      for (const series of data.document_series) {
        await tx.documentSeries.upsert({
          where: { code: series.code },
          update: { ...series },
          create: { ...series },
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

      for (const phase of data.crm_phases) {
        await tx.crmPhase.upsert({
          where: { id: phase.id },
          update: { ...phase },
          create: { ...phase },
        });
      }

      for (const status of data.crm_statuses) {
        await tx.crmCustomerStatus.upsert({
          where: { id: status.id },
          update: { ...status },
          create: { ...status },
        });
      }

      for (const opportunity of data.crm_opportunities) {
        await tx.crmOpportunity.upsert({
          where: { id: opportunity.id },
          update: { ...opportunity, ownerId: normalizeOwner(opportunity.ownerId) },
          create: { ...opportunity, ownerId: normalizeOwner(opportunity.ownerId) },
        });
      }

      for (const card of data.crm_cards) {
        await tx.crmCustomerCard.upsert({
          where: { id: card.id },
          update: { ...card, ownerId: normalizeOwner(card.ownerId ?? null) },
          create: { ...card, ownerId: normalizeOwner(card.ownerId ?? null) },
        });
      }

      for (const template of data.crm_task_templates) {
        await tx.crmTaskTemplate.upsert({
          where: { id: template.id },
          update: { ...template },
          create: { ...template },
        });
      }

      for (const segment of data.crm_segments) {
        await tx.crmSegment.upsert({
          where: { id: segment.id },
          update: { ...segment },
          create: { ...segment },
        });
      }

      for (const automation of data.crm_automations) {
        await tx.crmAutomation.upsert({
          where: { id: automation.id },
          update: { ...automation },
          create: { ...automation },
        });
      }

      for (const run of data.crm_automation_runs) {
        await tx.crmAutomationRun.upsert({
          where: {
            automationId_customerId: {
              automationId: run.automationId,
              customerId: run.customerId ?? null,
            },
          },
          update: { ...run },
          create: { ...run },
        });
      }

      for (const task of data.crm_tasks) {
        await tx.crmTask.upsert({
          where: { id: task.id },
          update: { ...task, ownerId: normalizeOwner(task.ownerId ?? null) },
          create: { ...task, ownerId: normalizeOwner(task.ownerId ?? null) },
        });
      }

      for (const note of data.crm_notes) {
        await tx.crmNote.upsert({
          where: { id: note.id },
          update: { ...note, ownerId: normalizeOwner(note.ownerId ?? null) },
          create: { ...note, ownerId: normalizeOwner(note.ownerId ?? null) },
        });
      }

      for (const event of data.crm_events) {
        await tx.crmEvent.upsert({
          where: { id: event.id },
          update: { ...event, ownerId: normalizeOwner(event.ownerId ?? null) },
          create: { ...event, ownerId: normalizeOwner(event.ownerId ?? null) },
        });
      }

      for (const notification of data.crm_notifications) {
        await tx.crmNotification.upsert({
          where: { id: notification.id },
          update: { ...notification, ownerId: normalizeOwner(notification.ownerId ?? null) },
          create: { ...notification, ownerId: normalizeOwner(notification.ownerId ?? null) },
        });
      }

      for (const closure of data.cash_closures) {
        await tx.cashClosure.upsert({
          where: { id: closure.id },
          update: { ...closure },
          create: { ...closure },
        });
      }
      },
      { maxWait: 120000, timeout: 120000 },
    );
    await this.importAuditLogs(data.audit_logs);
  }

  private async importAuditLogs(logs: Prisma.AuditLogCreateManyInput[]) {
    if (!logs || logs.length === 0) return;
    const validUserIds = new Set(
      (await this.prisma.user.findMany({ select: { id: true } })).map((u) => u.id),
    );
    const normalizeOwner = (ownerId?: number | null) =>
      ownerId && validUserIds.has(ownerId) ? ownerId : null;
    const batchSize = 1000;
    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize).map((log) => ({
        ...log,
        userId: normalizeOwner(log.userId ?? null),
      }));
      await this.prisma.auditLog.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }
  }
}
