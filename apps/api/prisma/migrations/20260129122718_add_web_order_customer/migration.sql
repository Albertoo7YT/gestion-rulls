-- AlterTable
ALTER TABLE "WebOrder" ADD COLUMN     "customerId" INTEGER;

-- AddForeignKey
ALTER TABLE "WebOrder" ADD CONSTRAINT "WebOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
