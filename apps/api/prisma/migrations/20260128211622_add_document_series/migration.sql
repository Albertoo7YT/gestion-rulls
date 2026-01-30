-- AlterTable
ALTER TABLE "StockMove" ADD COLUMN     "series_code" TEXT,
ADD COLUMN     "series_number" INTEGER,
ADD COLUMN     "series_year" INTEGER;

-- CreateTable
CREATE TABLE "DocumentSeries" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "prefix" TEXT,
    "year" INTEGER,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSeries_code_key" ON "DocumentSeries"("code");

-- CreateIndex
CREATE INDEX "DocumentSeries_scope_idx" ON "DocumentSeries"("scope");

-- CreateIndex
CREATE INDEX "DocumentSeries_year_idx" ON "DocumentSeries"("year");

-- CreateIndex
CREATE INDEX "StockMove_series_code_series_year_series_number_idx" ON "StockMove"("series_code", "series_year", "series_number");
