-- CreateTable
CREATE TABLE "WebOrder" (
    "wooOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAtWoo" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "assignedWarehouseId" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WebOrder_pkey" PRIMARY KEY ("wooOrderId")
);

-- CreateTable
CREATE TABLE "WebOrderLine" (
    "id" SERIAL NOT NULL,
    "wooOrderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "WebOrderLine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WebOrder" ADD CONSTRAINT "WebOrder_assignedWarehouseId_fkey" FOREIGN KEY ("assignedWarehouseId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderLine" ADD CONSTRAINT "WebOrderLine_wooOrderId_fkey" FOREIGN KEY ("wooOrderId") REFERENCES "WebOrder"("wooOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebOrderLine" ADD CONSTRAINT "WebOrderLine_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
