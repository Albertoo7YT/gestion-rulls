-- AlterTable
ALTER TABLE "crm_boards" ADD COLUMN     "phase_id" INTEGER;

-- CreateTable
CREATE TABLE "crm_phases" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_boards_phase_id_idx" ON "crm_boards"("phase_id");

-- AddForeignKey
ALTER TABLE "crm_boards" ADD CONSTRAINT "crm_boards_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "crm_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
