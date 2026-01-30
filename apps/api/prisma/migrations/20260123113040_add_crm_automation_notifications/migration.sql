-- CreateTable
CREATE TABLE "crm_notifications" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "owner_id" INTEGER,
    "customer_id" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "crm_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_automation_runs" (
    "id" SERIAL NOT NULL,
    "automation_id" INTEGER NOT NULL,
    "customer_id" INTEGER,
    "last_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "run_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "crm_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_notifications_owner_id_idx" ON "crm_notifications"("owner_id");

-- CreateIndex
CREATE INDEX "crm_notifications_customer_id_idx" ON "crm_notifications"("customer_id");

-- CreateIndex
CREATE INDEX "crm_notifications_read_at_idx" ON "crm_notifications"("read_at");

-- CreateIndex
CREATE INDEX "crm_automation_runs_last_run_at_idx" ON "crm_automation_runs"("last_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "crm_automation_runs_automation_id_customer_id_key" ON "crm_automation_runs"("automation_id", "customer_id");

-- AddForeignKey
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_notifications" ADD CONSTRAINT "crm_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automation_runs" ADD CONSTRAINT "crm_automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "crm_automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_automation_runs" ADD CONSTRAINT "crm_automation_runs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
