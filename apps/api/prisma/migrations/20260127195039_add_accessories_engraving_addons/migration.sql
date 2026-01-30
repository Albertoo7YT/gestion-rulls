-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "engravingCost" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "StockMoveLine" ADD COLUMN     "addOnCost" DECIMAL(10,2),
ADD COLUMN     "addOnPrice" DECIMAL(10,2),
ADD COLUMN     "addOns" JSONB;

-- CreateTable
CREATE TABLE "Accessory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(10,2),
    "price" DECIMAL(10,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);
