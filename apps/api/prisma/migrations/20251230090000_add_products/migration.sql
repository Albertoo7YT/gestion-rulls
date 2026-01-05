-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('standard', 'quick');

-- CreateTable
CREATE TABLE "Product" (
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "photoUrl" TEXT,
    "cost" DECIMAL(10,2),
    "rrp" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("sku")
);

-- CreateTable
CREATE TABLE "ProductCounter" (
    "id" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ProductCounter_pkey" PRIMARY KEY ("id")
);
