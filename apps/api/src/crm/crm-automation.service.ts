import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { Prisma, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type AutomationTrigger = "on_status_changed" | "on_task_completed" | "daily_scheduler";

type AutomationAction =
  | {
      type: "create_task";
      task?: {
        templateId?: number;
        type?: string;
        title?: string;
        description?: string;
        dueAt?: string;
        dueDays?: number;
        priority?: number;
        ownerId?: number;
      };
    }
  | { type: "notify"; message: string; level?: string; ownerId?: number }
  | { type: "set_priority"; priority: number }
  | { type: "add_tag"; tag: string }
  | { type: "move_status"; statusId?: number; statusName?: string; position?: number };

type CreateTaskAction = Extract<AutomationAction, { type: "create_task" }>;

type AutomationConditions = {
  fromStatusId?: number;
  toStatusId?: number;
  fromStatusName?: string;
  toStatusName?: string;
  taskType?: string;
  titleContains?: string;
  minDaysSinceLastActivity?: number;
  minDaysSinceLastPurchase?: number;
};

@Injectable()
export class CrmAutomationService {
  private readonly logger = new Logger(CrmAutomationService.name);
  private readonly statusCache = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async handleStatusChanged(input: {
    customerId: number;
    fromStatusId?: number | null;
    toStatusId: number;
  }) {
    const automations = await this.getAutomations("on_status_changed");
    for (const automation of automations) {
      if (
        await this.matchStatusChange(
          automation.conditions as AutomationConditions,
          input,
        )
      ) {
        await this.executeActions(
          automation.id,
          input.customerId,
          automation.actions as AutomationAction[],
        );
      }
    }
  }

  async handleTaskCompleted(task: {
    id: number;
    relatedCustomerId?: number | null;
    type: string;
    title: string;
  }) {
    if (!task.relatedCustomerId) return;
    const automations = await this.getAutomations("on_task_completed");
    for (const automation of automations) {
      if (this.matchTaskCompleted(automation.conditions as AutomationConditions, task)) {
        await this.executeActions(
          automation.id,
          task.relatedCustomerId,
          automation.actions as AutomationAction[],
        );
      }
    }
  }

  async runDailyScheduler() {
    const automations = await this.getAutomations("daily_scheduler");
    if (automations.length === 0) return;
    const customers = await this.prisma.customer.findMany({
      select: { id: true, createdAt: true },
    });
    for (const customer of customers) {
      for (const automation of automations) {
        if (
          await this.shouldRunDailyAutomation(
            automation,
            customer.id,
            customer.createdAt,
          )
        ) {
          await this.executeActions(
            automation.id,
            customer.id,
            automation.actions as AutomationAction[],
            true,
          );
        }
      }
    }
  }

  private async getAutomations(trigger: AutomationTrigger) {
    return this.prisma.crmAutomation.findMany({
      where: { trigger, enabled: true },
      orderBy: { id: "asc" },
    });
  }

  private async executeActions(
    automationId: number,
    customerId: number,
    actions: AutomationAction[],
    trackRun = false,
  ) {
    for (const action of actions) {
      switch (action.type) {
        case "create_task":
          await this.createTaskFromAutomation(customerId, action.task);
          break;
        case "notify":
          await this.prisma.crmNotification.create({
            data: {
              type: action.level ?? "info",
              message: action.message,
              customerId,
              ownerId: action.ownerId ?? undefined,
            },
          });
          break;
        case "set_priority":
          await this.upsertCard(customerId, { priority: action.priority });
          break;
        case "add_tag":
          await this.addTag(customerId, action.tag);
          break;
        case "move_status":
          await this.moveStatus(customerId, action.statusId, action.statusName, action.position);
          break;
        default:
          this.logger.warn(`Unknown CRM automation action: ${String(action)}`);
      }
    }

    if (trackRun) {
      await this.touchRun(automationId, customerId);
    }
  }

  private async matchStatusChange(
    conditions: AutomationConditions,
    input: { fromStatusId?: number | null; toStatusId: number },
  ) {
    if (conditions.fromStatusId && conditions.fromStatusId !== input.fromStatusId) {
      return false;
    }
    if (conditions.toStatusId && conditions.toStatusId !== input.toStatusId) {
      return false;
    }
    if (conditions.fromStatusName) {
      const id = await this.resolveStatusId(conditions.fromStatusName);
      if (id && id !== input.fromStatusId) return false;
    }
    if (conditions.toStatusName) {
      const id = await this.resolveStatusId(conditions.toStatusName);
      if (id && id !== input.toStatusId) return false;
    }
    return true;
  }

  private matchTaskCompleted(conditions: AutomationConditions, task: { type: string; title: string }) {
    if (conditions.taskType && conditions.taskType !== task.type) return false;
    if (conditions.titleContains) {
      const term = conditions.titleContains.toLowerCase();
      if (!task.title.toLowerCase().includes(term)) return false;
    }
    return true;
  }

  private async shouldRunDailyAutomation(
    automation: { id: number; conditions: Prisma.JsonValue },
    customerId: number,
    fallbackCreatedAt: Date,
  ) {
    const run = await this.prisma.crmAutomationRun.findUnique({
      where: { automationId_customerId: { automationId: automation.id, customerId } },
    });
    const now = new Date();
    if (run && this.isSameDay(run.lastRunAt, now)) {
      return false;
    }

    const conditions = automation.conditions as AutomationConditions;
    if (conditions.minDaysSinceLastActivity) {
      const lastActivity = await this.getLastActivity(customerId, fallbackCreatedAt);
      if (!this.isOlderThanDays(lastActivity, conditions.minDaysSinceLastActivity)) {
        return false;
      }
    }
    if (conditions.minDaysSinceLastPurchase) {
      const lastPurchase = await this.getLastPurchase(customerId);
      if (!this.isOlderThanDays(lastPurchase ?? fallbackCreatedAt, conditions.minDaysSinceLastPurchase)) {
        return false;
      }
    }
    return true;
  }

  private async createTaskFromAutomation(
    customerId: number,
    task?: CreateTaskAction["task"],
  ) {
    let payload = task ?? {};
    if (payload.templateId) {
      const template = await this.prisma.crmTaskTemplate.findUnique({
        where: { id: payload.templateId },
      });
      if (template) {
        payload = {
          ...payload,
          type: payload.type ?? template.type,
          title: payload.title ?? template.title,
          description: payload.description ?? template.description ?? undefined,
          priority: payload.priority ?? template.priority,
          dueDays: payload.dueDays ?? template.dueDays ?? undefined,
        };
      }
    }

    const dueAt =
      payload.dueAt
        ? new Date(payload.dueAt)
        : typeof payload.dueDays === "number"
          ? this.addDays(new Date(), payload.dueDays)
          : undefined;

    await this.prisma.crmTask.create({
      data: {
        type: payload.type ?? "task",
        title: payload.title ?? "Tarea CRM",
        description: payload.description,
        dueAt,
        priority: payload.priority ?? 0,
        ownerId: payload.ownerId ?? undefined,
        relatedCustomerId: customerId,
      },
    });
  }

  private async upsertCard(
    customerId: number,
    data: Prisma.CrmCustomerCardUncheckedUpdateInput,
  ) {
    const phaseId = await this.resolvePhaseIdFromStatus(data.statusId as number | undefined);
    return this.prisma.crmCustomerCard.upsert({
      where: { customerId },
      update: data,
      create: {
        customerId,
        phaseId,
        priority: data.priority as number | undefined,
      },
    });
  }

  private async addTag(customerId: number, tag: string) {
    const card = await this.prisma.crmCustomerCard.findUnique({
      where: { customerId },
    });
    const tags = new Set(card?.tags ?? []);
    tags.add(tag);
    await this.prisma.crmCustomerCard.upsert({
      where: { customerId },
      update: { tags: Array.from(tags) },
      create: {
        customerId,
        phaseId: card?.phaseId ?? (await this.getDefaultPhaseId()),
        tags: Array.from(tags),
      },
    });
  }

  private async moveStatus(
    customerId: number,
    statusId?: number,
    statusName?: string,
    position?: number,
  ) {
    const resolvedStatusId =
      statusId ?? (statusName ? await this.resolveStatusId(statusName) : undefined);
    if (!resolvedStatusId) return;
    const phaseId = await this.resolvePhaseIdFromStatus(resolvedStatusId);
    await this.prisma.crmCustomerCard.upsert({
      where: { customerId },
      update: {
        statusId: resolvedStatusId,
        phaseId,
        priority: typeof position === "number" ? position : undefined,
      },
      create: {
        customerId,
        statusId: resolvedStatusId,
        phaseId,
        priority: typeof position === "number" ? position : 0,
      },
    });
  }

  private async resolvePhaseIdFromStatus(statusId?: number) {
    if (!statusId) return this.getDefaultPhaseId();
    const status = await this.prisma.crmCustomerStatus.findUnique({
      where: { id: statusId },
      select: { phaseId: true },
    });
    return status?.phaseId ?? this.getDefaultPhaseId();
  }

  private async getDefaultPhaseId() {
    const phase = await this.prisma.crmPhase.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!phase) throw new NotFoundException("CRM phase not found");
    return phase.id;
  }

  private async touchRun(automationId: number, customerId: number) {
    await this.prisma.crmAutomationRun.upsert({
      where: { automationId_customerId: { automationId, customerId } },
      update: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
      },
      create: {
        automationId,
        customerId,
        lastRunAt: new Date(),
        runCount: 1,
      },
    });
  }

  private async getLastActivity(customerId: number, fallback: Date) {
    const note = await this.prisma.crmNote.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const event = await this.prisma.crmEvent.findFirst({
      where: { customerId },
      orderBy: { startAt: "desc" },
      select: { startAt: true },
    });
    const task = await this.prisma.crmTask.findFirst({
      where: { relatedCustomerId: customerId },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });
    const purchase = await this.prisma.stockMove.findFirst({
      where: {
        customerId,
        type: { in: [StockMoveType.b2b_sale, StockMoveType.b2c_sale] },
      },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    const dates = [
      note?.createdAt,
      event?.startAt,
      task?.updatedAt,
      purchase?.date,
      fallback,
    ].filter(Boolean) as Date[];
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  private async getLastPurchase(customerId: number) {
    const move = await this.prisma.stockMove.findFirst({
      where: {
        customerId,
        type: { in: [StockMoveType.b2b_sale, StockMoveType.b2c_sale] },
      },
      orderBy: { date: "desc" },
      select: { date: true },
    });
    return move?.date ?? null;
  }

  private async resolveStatusId(name: string) {
    const cached = this.statusCache.get(name);
    if (cached) return cached;
    const status = await this.prisma.crmCustomerStatus.findFirst({
      where: { name },
      select: { id: true },
    });
    if (status) {
      this.statusCache.set(name, status.id);
      return status.id;
    }
    return null;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private isOlderThanDays(date: Date, days: number) {
    const limit = this.addDays(new Date(), -days);
    return date.getTime() <= limit.getTime();
  }

  private isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}
