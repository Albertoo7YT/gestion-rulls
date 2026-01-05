-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('purchase', 'transfer', 'b2b_sale', 'b2c_sale', 'adjust');

-- CreateEnum
CREATE TYPE "StockMoveChannel" AS ENUM ('INTERNAL', 'B2B', 'B2C');

-- CreateTable
CREATE TABLE "StockMove" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "StockMoveType" NOT NULL,
    "channel" "StockMoveChannel" NOT NULL,
    "fromId" INTEGER,
    "toId" INTEGER,
    "reference" TEXT,
    "notes" TEXT,

    CONSTRAINT "StockMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMoveLine" (
    "id" SERIAL NOT NULL,
    "moveId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "unitCost" DECIMAL(10,2),

    CONSTRAINT "StockMoveLine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMoveLine" ADD CONSTRAINT "StockMoveLine_moveId_fkey" FOREIGN KEY ("moveId") REFERENCES "StockMove"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMoveLine" ADD CONSTRAINT "StockMoveLine_sku_fkey" FOREIGN KEY ("sku") REFERENCES "Product"("sku") ON DELETE RESTRICT ON UPDATE CASCADE;
