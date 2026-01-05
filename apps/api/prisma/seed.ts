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

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminUsername && adminPassword) {
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
