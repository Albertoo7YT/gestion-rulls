ALTER TYPE "StockMoveType" ADD VALUE 'b2b_return';
ALTER TYPE "StockMoveType" ADD VALUE 'b2c_return';

ALTER TABLE "StockMove" ADD COLUMN "relatedMoveId" INTEGER;

ALTER TABLE "StockMove" ADD CONSTRAINT "StockMove_relatedMoveId_fkey" FOREIGN KEY ("relatedMoveId") REFERENCES "StockMove"("id") ON DELETE SET NULL ON UPDATE CASCADE;