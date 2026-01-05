-- CreateEnum
CREATE TYPE "PriceRuleTarget" AS ENUM ('public', 'b2b');

-- CreateEnum
CREATE TYPE "PriceRuleScope" AS ENUM ('all', 'category', 'supplier');

-- CreateEnum
CREATE TYPE "PriceRuleType" AS ENUM ('percent', 'fixed');

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "target" "PriceRuleTarget" NOT NULL,
    "scope" "PriceRuleScope" NOT NULL,
    "type" "PriceRuleType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" INTEGER,
    "supplierId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceRule" ADD CONSTRAINT "PriceRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
