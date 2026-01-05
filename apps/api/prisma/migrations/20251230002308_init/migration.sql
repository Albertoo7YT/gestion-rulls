-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('warehouse', 'retail');

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL,
    "wooSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wooStockWarehouseIds" JSONB NOT NULL,
    "lastWooSyncAt" TIMESTAMP(3),

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
