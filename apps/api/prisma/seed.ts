import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const socuellamos =
    (await prisma.location.findFirst({ where: { name: "Socuéllamos" } })) ??
    (await prisma.location.create({
      data: {
        type: "warehouse",
        name: "Socuéllamos",
        city: "Socuéllamos",
        active: true,
      },
    }));

  const alicante =
    (await prisma.location.findFirst({ where: { name: "Alicante" } })) ??
    (await prisma.location.create({
      data: {
        type: "warehouse",
        name: "Alicante",
        city: "Alicante",
        active: true,
      },
    }));

  await prisma.settings.upsert({
    where: { id: 1 },
    update: {
      wooSyncEnabled: true,
      wooStockWarehouseIds: [socuellamos.id, alicante.id],
      lastWooSyncAt: null,
    },
    create: {
      id: 1,
      wooSyncEnabled: true,
      wooStockWarehouseIds: [socuellamos.id, alicante.id],
      lastWooSyncAt: null,
    },
  });

  const currentYear = new Date().getFullYear();
  const seriesDefs = [
    {
      code: `B2C-${currentYear}`,
      name: `Ventas B2C ${currentYear}`,
      scope: "sale_b2c",
      prefix: "B2C",
      year: currentYear,
    },
    {
      code: `B2B-${currentYear}`,
      name: `Ventas B2B ${currentYear}`,
      scope: "sale_b2b",
      prefix: "B2B",
      year: currentYear,
    },
    {
      code: `DEV-${currentYear}`,
      name: `Devoluciones ${currentYear}`,
      scope: "return",
      prefix: "DEV",
      year: currentYear,
    },
    {
      code: `DEP-${currentYear}`,
      name: `Depositos ${currentYear}`,
      scope: "deposit",
      prefix: "DEP",
      year: currentYear,
    },
    {
      code: `WEB-${currentYear}`,
      name: `Pedidos web ${currentYear}`,
      scope: "web",
      prefix: "WEB",
      year: currentYear,
    },
  ];

  for (const series of seriesDefs) {
    const existing = await prisma.documentSeries.findUnique({
      where: { code: series.code },
    });
    if (!existing) {
      await prisma.documentSeries.create({
        data: {
          code: series.code,
          name: series.name,
          scope: series.scope,
          prefix: series.prefix,
          year: series.year,
          nextNumber: 1,
          padding: 6,
          active: true,
        },
      });
    }
  }

  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "ipad609@gmail.com";
  const adminUsername =
    process.env.ADMIN_USERNAME?.trim().toLowerCase() ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin123";

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { username: adminUsername }] },
  });
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: "admin",
        active: true,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        email: adminEmail,
        username: adminUsername,
        passwordHash,
        role: "admin",
        active: true,
      },
    });
  }

  const crmPhase = await prisma.crmPhase.upsert({
    where: { id: 1 },
    update: { name: "Leads", sortOrder: 1 },
    create: { name: "Leads", sortOrder: 1 },
  });

  const crmStatuses = [
    { name: "Nuevo/sin contacto", order: 1 },
    { name: "Contactado", order: 2 },
    { name: "Interesado/seguimiento", order: 3 },
    { name: "Pendiente de info", order: 4 },
    { name: "Listo para compra", order: 5 },
    { name: "Cliente activo", order: 6 },
    { name: "Postventa", order: 7 },
    { name: "Dormido", order: 8 },
    { name: "Recuperacion", order: 9 },
    { name: "Perdido/no interesa", order: 10 },
  ];

  for (const status of crmStatuses) {
    const existing = await prisma.crmCustomerStatus.findFirst({
      where: { name: status.name, phaseId: crmPhase.id },
    });
    if (!existing) {
      await prisma.crmCustomerStatus.create({
        data: {
          name: status.name,
          sortOrder: status.order,
          phaseId: crmPhase.id,
        },
      });
    } else if (
      existing.sortOrder !== status.order ||
      existing.phaseId !== crmPhase.id
    ) {
      await prisma.crmCustomerStatus.update({
        where: { id: existing.id },
        data: { sortOrder: status.order, phaseId: crmPhase.id },
      });
    }
  }

  await prisma.crmCustomerCard.updateMany({
    where: { phaseId: null },
    data: { phaseId: crmPhase.id },
  });

  const crmAutomations = [
    {
      name: "Nuevo -> Primer contacto",
      trigger: "on_status_changed",
      conditions: { toStatusName: "Nuevo/sin contacto" },
      actions: [
        {
          type: "create_task",
          task: { type: "call", title: "Primer contacto", dueDays: 0 },
        },
      ],
    },
    {
      name: "Interesado -> Catalogo + Seguimiento",
      trigger: "on_status_changed",
      conditions: { toStatusName: "Interesado/seguimiento" },
      actions: [
        {
          type: "create_task",
          task: { type: "email", title: "Enviar catalogo", dueDays: 0 },
        },
        {
          type: "create_task",
          task: { type: "follow_up", title: "Seguimiento 48h", dueDays: 2 },
        },
      ],
    },
    {
      name: "Cliente activo -> Postventa 48h",
      trigger: "on_status_changed",
      conditions: { toStatusName: "Cliente activo" },
      actions: [
        {
          type: "create_task",
          task: { type: "post_sale", title: "Postventa 48h", dueDays: 2 },
        },
      ],
    },
    {
      name: "Sin compra 60 dias -> Dormido",
      trigger: "daily_scheduler",
      conditions: { minDaysSinceLastPurchase: 60 },
      actions: [
        { type: "move_status", statusName: "Dormido" },
        {
          type: "create_task",
          task: { type: "recovery", title: "Recuperacion", dueDays: 0 },
        },
      ],
    },
    {
      name: "Sin actividad 7 dias -> Prioridad alta",
      trigger: "daily_scheduler",
      conditions: { minDaysSinceLastActivity: 7 },
      actions: [
        {
          type: "notify",
          message: "Cliente sin actividad 7 dias",
          level: "warning",
        },
        { type: "set_priority", priority: 1 },
      ],
    },
  ];

  for (const automation of crmAutomations) {
    const existing = await prisma.crmAutomation.findFirst({
      where: { name: automation.name },
    });
    if (!existing) {
      await prisma.crmAutomation.create({
        data: {
          name: automation.name,
          trigger: automation.trigger,
          conditions: automation.conditions,
          actions: automation.actions,
          enabled: true,
        },
      });
    }
  }

  const crmSegments = [
    {
      name: "Dormidos 60 dias",
      filters: { lastPurchaseDays: 60 },
    },
    {
      name: "VIP sin compra 30 dias",
      filters: { totalSpentMin: 1000, lastPurchaseDays: 30 },
    },
    {
      name: "Ticket medio alto",
      filters: { avgTicketMin: 150 },
    },
    {
      name: "Compra recurrente",
      filters: { purchaseCountMin: 3 },
    },
    {
      name: "Alta devolucion",
      filters: { returnsCountMin: 2 },
    },
  ];

  for (const segment of crmSegments) {
    const existing = await prisma.crmSegment.findFirst({
      where: { name: segment.name },
    });
    if (!existing) {
      await prisma.crmSegment.create({
        data: {
          name: segment.name,
          filters: segment.filters,
          dynamic: true,
        },
      });
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
