-- AlterTable
ALTER TABLE "crm_customer_cards" ADD COLUMN     "board_id" INTEGER;

-- AlterTable
ALTER TABLE "crm_customer_statuses" ADD COLUMN     "board_id" INTEGER;

-- CreateTable
CREATE TABLE "crm_boards" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_boards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_customer_cards_board_id_idx" ON "crm_customer_cards"("board_id");

-- CreateIndex
CREATE INDEX "crm_customer_statuses_board_id_idx" ON "crm_customer_statuses"("board_id");

-- AddForeignKey
ALTER TABLE "crm_customer_statuses" ADD CONSTRAINT "crm_customer_statuses_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "crm_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_cards" ADD CONSTRAINT "crm_customer_cards_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "crm_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
