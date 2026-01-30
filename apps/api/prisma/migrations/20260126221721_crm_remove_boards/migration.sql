/*
  Warnings:

  - You are about to drop the column `board_id` on the `crm_customer_cards` table. All the data in the column will be lost.
  - You are about to drop the column `board_id` on the `crm_customer_statuses` table. All the data in the column will be lost.
  - You are about to drop the `crm_boards` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "crm_boards" DROP CONSTRAINT "crm_boards_phase_id_fkey";

-- DropForeignKey
ALTER TABLE "crm_customer_cards" DROP CONSTRAINT "crm_customer_cards_board_id_fkey";

-- DropForeignKey
ALTER TABLE "crm_customer_statuses" DROP CONSTRAINT "crm_customer_statuses_board_id_fkey";

-- DropIndex
DROP INDEX "crm_customer_cards_board_id_idx";

-- DropIndex
DROP INDEX "crm_customer_statuses_board_id_idx";

-- AlterTable
ALTER TABLE "crm_customer_cards" DROP COLUMN "board_id",
ADD COLUMN     "phase_id" INTEGER;

-- AlterTable
ALTER TABLE "crm_customer_statuses" DROP COLUMN "board_id",
ADD COLUMN     "phase_id" INTEGER;

-- DropTable
DROP TABLE "crm_boards";

-- CreateIndex
CREATE INDEX "crm_customer_cards_phase_id_idx" ON "crm_customer_cards"("phase_id");

-- CreateIndex
CREATE INDEX "crm_customer_statuses_phase_id_idx" ON "crm_customer_statuses"("phase_id");

-- AddForeignKey
ALTER TABLE "crm_customer_statuses" ADD CONSTRAINT "crm_customer_statuses_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "crm_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_cards" ADD CONSTRAINT "crm_customer_cards_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "crm_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
