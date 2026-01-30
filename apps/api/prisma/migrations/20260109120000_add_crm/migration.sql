CREATE TABLE "crm_customer_statuses" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "rules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "crm_customer_cards" (
  "id" SERIAL PRIMARY KEY,
  "customer_id" INTEGER NOT NULL,
  "status_id" INTEGER,
  "owner_id" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_customer_cards_customer_id_key" UNIQUE ("customer_id"),
  CONSTRAINT "crm_customer_cards_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_customer_cards_status_id_fkey" FOREIGN KEY ("status_id")
    REFERENCES "crm_customer_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_customer_cards_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_customer_cards_status_id_idx" ON "crm_customer_cards"("status_id");
CREATE INDEX "crm_customer_cards_owner_id_idx" ON "crm_customer_cards"("owner_id");

CREATE TABLE "crm_task_templates" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "due_days" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "crm_opportunities" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "stage" TEXT,
  "value" DECIMAL(12, 2),
  "customer_id" INTEGER,
  "owner_id" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_opportunities_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_opportunities_customer_id_idx" ON "crm_opportunities"("customer_id");
CREATE INDEX "crm_opportunities_owner_id_idx" ON "crm_opportunities"("owner_id");

CREATE TABLE "crm_tasks" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "owner_id" INTEGER,
  "related_customer_id" INTEGER,
  "related_opportunity_id" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_tasks_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_tasks_related_customer_id_fkey" FOREIGN KEY ("related_customer_id")
    REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_tasks_related_opportunity_id_fkey" FOREIGN KEY ("related_opportunity_id")
    REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_tasks_owner_id_idx" ON "crm_tasks"("owner_id");
CREATE INDEX "crm_tasks_related_customer_id_idx" ON "crm_tasks"("related_customer_id");
CREATE INDEX "crm_tasks_related_opportunity_id_idx" ON "crm_tasks"("related_opportunity_id");
CREATE INDEX "crm_tasks_due_at_idx" ON "crm_tasks"("due_at");

CREATE TABLE "crm_events" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "title" TEXT,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3),
  "owner_id" INTEGER,
  "customer_id" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_events_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_events_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_events_start_at_idx" ON "crm_events"("start_at");
CREATE INDEX "crm_events_owner_id_idx" ON "crm_events"("owner_id");
CREATE INDEX "crm_events_customer_id_idx" ON "crm_events"("customer_id");

CREATE TABLE "crm_notes" (
  "id" SERIAL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "owner_id" INTEGER,
  "customer_id" INTEGER,
  "task_id" INTEGER,
  "opportunity_id" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_notes_owner_id_fkey" FOREIGN KEY ("owner_id")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_notes_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_notes_task_id_fkey" FOREIGN KEY ("task_id")
    REFERENCES "crm_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_notes_opportunity_id_fkey" FOREIGN KEY ("opportunity_id")
    REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_notes_owner_id_idx" ON "crm_notes"("owner_id");
CREATE INDEX "crm_notes_customer_id_idx" ON "crm_notes"("customer_id");
CREATE INDEX "crm_notes_task_id_idx" ON "crm_notes"("task_id");
CREATE INDEX "crm_notes_opportunity_id_idx" ON "crm_notes"("opportunity_id");
CREATE INDEX "crm_notes_created_at_idx" ON "crm_notes"("createdAt");

CREATE TABLE "crm_automations" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "conditions" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "crm_automations_enabled_idx" ON "crm_automations"("enabled");
CREATE INDEX "crm_automations_trigger_idx" ON "crm_automations"("trigger");

CREATE TABLE "crm_segments" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "dynamic" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
