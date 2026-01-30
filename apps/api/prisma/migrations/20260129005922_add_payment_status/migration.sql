-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'partial', 'paid');

-- AlterTable
ALTER TABLE "StockMove" ADD COLUMN     "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending';
