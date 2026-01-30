import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CrmAutomationService } from "./crm-automation.service";
import { PosService } from "../pos/pos.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListBoardQueryDto } from "./dto/list-board-query.dto";
import { MoveBoardDto } from "./dto/move-board.dto";
import { ListTasksQueryDto } from "./dto/list-tasks-query.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { BulkCreateTasksDto } from "./dto/bulk-create-tasks.dto";
import { ListCalendarQueryDto } from "./dto/list-calendar-query.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { CreateNoteDto } from "./dto/create-note.dto";
import { CreateSegmentDto } from "./dto/create-segment.dto";
import { CreatePhaseDto } from "./dto/create-phase.dto";
import { UpdatePhaseDto } from "./dto/update-phase.dto";
import { CreateStatusDto } from "./dto/create-status.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { UpdateAutomationDto } from "./dto/update-automation.dto";

type CrmExportManifest = {
  version: string;
  createdAt: string;
};

const CRM_EXPORT_VERSION = "1.0.0";

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automations: CrmAutomationService,
    private readonly pos: PosService,
  ) {}

  async listBoard(query: ListBoardQueryDto) {
    const selectedPhaseId = await this.resolvePhaseId(query.phase);
    const statuses = await this.prisma.crmCustomerStatus.findMany({
      where: {
        phaseId: selectedPhaseId,
        ...(query.status ? { id: query.status } : {}),
      },
      orderBy: { sortOrder: "asc" },
    });

    const where: Prisma.CrmCustomerCardWhereInput = {};
    if (query.owner) where.ownerId = query.owner;
    if (query.status) where.statusId = query.status;
    where.phaseId = selectedPhaseId;
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.customer = {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { taxId: { contains: term, mode: "insensitive" } },
        ],
      };
    }

    const cards = await this.prisma.crmCustomerCard.findMany({
      where,
      include: {
        customer: true,
        status: true,
        owner: true,
      },
      orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
    });

    const byStatus = new Map<number, typeof cards>();
    for (const card of cards) {
      const statusId = card.statusId ?? 0;
      const current = byStatus.get(statusId) ?? [];
      current.push(card);
      byStatus.set(statusId, current);
    }

    return {
      phaseId: selectedPhaseId,
      statuses: statuses.map((status) => ({
        id: status.id,
        name: status.name,
        order: status.sortOrder,
        color: status.color,
        rules: status.rules,
        cards: (byStatus.get(status.id) ?? []).map((card) => ({
          id: card.id,
          customerId: card.customerId,
          priority: card.priority,
          tags: card.tags,
          owner: card.owner
            ? { id: card.owner.id, username: card.owner.username }
            : null,
          customer: {
            id: card.customer.id,
            name: card.customer.name,
            email: card.customer.email,
            phone: card.customer.phone,
            type: card.customer.type,
            active: card.customer.active,
          },
        })),
      })),
      unassigned: (byStatus.get(0) ?? []).map((card) => ({
        id: card.id,
        customerId: card.customerId,
        priority: card.priority,
        tags: card.tags,
        owner: card.owner
          ? { id: card.owner.id, username: card.owner.username }
          : null,
        customer: {
          id: card.customer.id,
          name: card.customer.name,
          email: card.customer.email,
          phone: card.customer.phone,
          type: card.customer.type,
          active: card.customer.active,
        },
      })),
    };
  }

  async moveBoard(dto: MoveBoardDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const existingCard = await this.prisma.crmCustomerCard.findUnique({
      where: { customerId: dto.customerId },
      select: { statusId: true },
    });

    const status = await this.prisma.crmCustomerStatus.findUnique({
      where: { id: dto.toStatusId },
    });
    if (!status) throw new NotFoundException("CRM status not found");

    const targetPhaseId =
      dto.toPhaseId ?? status.phaseId ?? (await this.resolvePhaseId());
    if (status.phaseId && status.phaseId !== targetPhaseId) {
      throw new BadRequestException("Status does not belong to phase");
    }

    const updated = await this.prisma.crmCustomerCard.upsert({
      where: { customerId: dto.customerId },
      update: {
        statusId: dto.toStatusId,
        phaseId: targetPhaseId,
        priority: dto.position ?? 0,
      },
      create: {
        customerId: dto.customerId,
        statusId: dto.toStatusId,
        phaseId: targetPhaseId,
        priority: dto.position ?? 0,
      },
    });

    if (existingCard?.statusId !== dto.toStatusId) {
      await this.automations.handleStatusChanged({
        customerId: dto.customerId,
        fromStatusId: existingCard?.statusId ?? null,
        toStatusId: dto.toStatusId,
      });
    }

    return updated;
  }

  async customerSummary(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        crmCard: {
          include: { status: true, owner: true },
        },
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const nextTask = await this.prisma.crmTask.findFirst({
      where: { relatedCustomerId: id, completedAt: null },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });

    const notes = await this.prisma.crmNote.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { owner: true },
    });

    const events = await this.prisma.crmEvent.findMany({
      where: { customerId: id },
      orderBy: { startAt: "desc" },
      take: 5,
      include: { owner: true },
    });

    const sales = await this.prisma.$queryRaw<
      { total: number; count: number; lastDate: Date | null }[]
    >`
      SELECT
        COALESCE(SUM(l."quantity" * COALESCE(l."unitPrice", 0)), 0) AS total,
        COUNT(DISTINCT m."id") AS count,
        MAX(m."date") AS "lastDate"
      FROM "StockMoveLine" l
      JOIN "StockMove" m ON m."id" = l."moveId"
      WHERE m."customerId" = ${id}
        AND m."type"::text IN (${StockMoveType.b2b_sale}, ${StockMoveType.b2c_sale})
    `;

    const salesRow = sales[0] ?? { total: 0, count: 0, lastDate: null };

    const interactions = [
      ...notes.map((note) => ({
        type: "note",
        id: note.id,
        at: note.createdAt,
        content: note.content,
        owner: note.owner?.username ?? null,
      })),
      ...events.map((event) => ({
        type: "event",
        id: event.id,
        at: event.startAt,
        content: event.title ?? event.type,
        owner: event.owner?.username ?? null,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    return {
      customer,
      crmStatus: customer.crmCard?.status ?? null,
      crmOwner: customer.crmCard?.owner ?? null,
      nextTask,
      lastInteractions: interactions.slice(0, 5),
      sales: {
        total: Number(salesRow.total ?? 0),
        count: Number(salesRow.count ?? 0),
        lastDate: salesRow.lastDate,
      },
    };
  }

  async listCustomerOrders(id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const moves = await this.prisma.stockMove.findMany({
      where: {
        customerId: id,
        type: {
          in: [
            StockMoveType.b2b_sale,
            StockMoveType.b2c_sale,
            StockMoveType.b2b_return,
            StockMoveType.b2c_return,
          ],
        },
      },
      orderBy: { date: "desc" },
      include: {
        lines: {
          select: { quantity: true, unitPrice: true, addOnPrice: true },
        },
      },
    });

    return moves.map((move) => {
      const total = move.lines.reduce((sum, line) => {
        const lineTotal =
          Number(line.unitPrice ?? 0) * line.quantity +
          Number(line.addOnPrice ?? 0);
        return sum + lineTotal;
      }, 0);

      return {
        id: move.id,
        type: move.type,
        reference: move.reference,
        seriesCode: move.seriesCode,
        seriesYear: move.seriesYear,
        seriesNumber: move.seriesNumber,
        date: move.date,
        total,
      };
    });
  }

  async listTasks(query: ListTasksQueryDto) {
    const where: Prisma.CrmTaskWhereInput = {};
    if (query.owner) where.ownerId = query.owner;
    if (query.status === "pending") where.completedAt = null;
    if (query.status === "done") where.completedAt = { not: null };
    if (query.from || query.to) {
      where.dueAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    if (query.q?.trim()) {
      const term = query.q.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { customer: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    return this.prisma.crmTask.findMany({
      where,
      include: {
        customer: true,
        owner: true,
        opportunity: true,
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async createTask(dto: CreateTaskDto) {
    await this.ensureCustomer(dto.relatedCustomerId);
    await this.ensureOpportunity(dto.relatedOpportunityId);

    return this.prisma.crmTask.create({
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority ?? 0,
        ownerId: dto.ownerId,
        relatedCustomerId: dto.relatedCustomerId,
        relatedOpportunityId: dto.relatedOpportunityId,
      },
    });
  }

  async updateTask(id: number, dto: UpdateTaskDto) {
    await this.ensureCustomer(dto.relatedCustomerId);
    await this.ensureOpportunity(dto.relatedOpportunityId);
    const existing = await this.getTask(id);

    const updated = await this.prisma.crmTask.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
        priority: dto.priority,
        ownerId: dto.ownerId,
        relatedCustomerId: dto.relatedCustomerId,
        relatedOpportunityId: dto.relatedOpportunityId,
      },
    });

    if (!existing.completedAt && updated.completedAt) {
      await this.automations.handleTaskCompleted({
        id: updated.id,
        relatedCustomerId: updated.relatedCustomerId,
        type: updated.type,
        title: updated.title,
      });
    }

    return updated;
  }

  async deleteTask(id: number) {
    await this.getTask(id);
    await this.prisma.crmTask.delete({ where: { id } });
    return { ok: true };
  }

  async bulkCreateTasks(dto: BulkCreateTasksDto) {
    const segment = await this.prisma.crmSegment.findUnique({
      where: { id: dto.segmentId },
    });
    if (!segment) throw new NotFoundException("Segment not found");
    const customers = await this.resolveSegmentCustomers(segment);
    if (customers.length === 0) {
      return { created: 0 };
    }
    const dueAt = dto.task.dueAt ? new Date(dto.task.dueAt) : undefined;
    const data = customers.map((customer) => ({
      type: dto.task.type,
      title: dto.task.title,
      description: dto.task.description,
      dueAt,
      priority: dto.task.priority ?? 0,
      ownerId: dto.task.ownerId,
      relatedCustomerId: customer.id,
    }));
    await this.prisma.crmTask.createMany({ data });
    return { created: data.length };
  }

  async listCalendar(query: ListCalendarQueryDto) {
    const where: Prisma.CrmEventWhereInput = {};
    if (query.owner) where.ownerId = query.owner;
    if (query.from || query.to) {
      where.startAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }
    return this.prisma.crmEvent.findMany({
      where,
      include: { owner: true, customer: true },
      orderBy: { startAt: "asc" },
    });
  }

  async createEvent(dto: CreateEventDto) {
    await this.ensureCustomer(dto.customerId);
    return this.prisma.crmEvent.create({
      data: {
        type: dto.type,
        title: dto.title,
        startAt: new Date(dto.startAt),
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        ownerId: dto.ownerId,
        customerId: dto.customerId,
      },
    });
  }

  async updateEvent(id: number, dto: UpdateEventDto) {
    await this.ensureCustomer(dto.customerId);
    await this.getEvent(id);
    return this.prisma.crmEvent.update({
      where: { id },
      data: {
        type: dto.type,
        title: dto.title,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        ownerId: dto.ownerId,
        customerId: dto.customerId,
      },
    });
  }

  async getTimeline(customerId: number) {
    await this.ensureCustomer(customerId);
    const notes = await this.prisma.crmNote.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      include: { owner: true },
    });
    const events = await this.prisma.crmEvent.findMany({
      where: { customerId },
      orderBy: { startAt: "desc" },
      include: { owner: true },
    });
    const tasks = await this.prisma.crmTask.findMany({
      where: { relatedCustomerId: customerId },
      orderBy: { createdAt: "desc" },
    });

    const timeline = [
      ...notes.map((note) => ({
        type: "note",
        id: note.id,
        at: note.createdAt,
        content: note.content,
        owner: note.owner?.username ?? null,
      })),
      ...events.map((event) => ({
        type: "event",
        id: event.id,
        at: event.startAt,
        content: event.title ?? event.type,
        owner: event.owner?.username ?? null,
      })),
      ...tasks.map((task) => ({
        type: "task",
        id: task.id,
        at: task.completedAt ?? task.createdAt,
        content: task.title,
        done: Boolean(task.completedAt),
      })),
    ];

    return timeline.sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  async createNote(customerId: number, dto: CreateNoteDto, ownerId?: number) {
    await this.ensureCustomer(customerId);
    let safeOwnerId: number | null = ownerId ?? null;
    if (safeOwnerId) {
      const owner = await this.prisma.user.findUnique({
        where: { id: safeOwnerId },
        select: { id: true },
      });
      if (!owner) {
        safeOwnerId = null;
      }
    }
    return this.prisma.crmNote.create({
      data: {
        content: dto.content,
        customerId,
        ownerId: safeOwnerId,
      },
    });
  }

  async createOrderForCustomer(
    customerId: number,
    dto: CreateOrderDto,
    ownerId?: number,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const channel =
      dto.channel ?? (customer.type === "b2b" ? "B2B" : "B2C");

    const sale = await this.pos.createSale({
      warehouseId: dto.warehouseId,
      channel,
      customerId,
      reference: dto.reference,
      notes: dto.notes,
      paymentMethod: dto.paymentMethod,
      date: dto.date,
      giftSale: dto.giftSale,
      allowNegativeStock: dto.allowNegativeStock,
      lines: dto.lines,
    });

    const reference = sale.reference ?? `POS-${sale.id}`;
    await this.prisma.crmNote.create({
      data: {
        customerId,
        ownerId,
        content: `Pedido creado: ${reference} (id ${sale.id})`,
      },
    });

    return sale;
  }

  async listSegments() {
    return this.prisma.crmSegment.findMany({ orderBy: { name: "asc" } });
  }

  async createSegment(dto: CreateSegmentDto) {
    return this.prisma.crmSegment.create({
      data: {
        name: dto.name,
        filters: dto.filters as Prisma.InputJsonValue,
        dynamic: dto.dynamic ?? true,
      },
    });
  }

  async listSegmentCustomers(id: number) {
    const segment = await this.prisma.crmSegment.findUnique({ where: { id } });
    if (!segment) throw new NotFoundException("Segment not found");
    return this.resolveSegmentCustomers(segment);
  }

  async listStatuses(phaseId?: number) {
    return this.prisma.crmCustomerStatus.findMany({
      where: phaseId ? { phaseId } : undefined,
      orderBy: [{ phaseId: "asc" }, { sortOrder: "asc" }],
    });
  }

  async createStatus(dto: CreateStatusDto) {
    await this.ensurePhase(dto.phaseId);
    const order =
      typeof dto.sortOrder === "number"
        ? dto.sortOrder
        : ((await this.prisma.crmCustomerStatus.aggregate({
            _max: { sortOrder: true },
            where: { phaseId: dto.phaseId },
          }))._max.sortOrder ?? 0) + 1;
    return this.prisma.crmCustomerStatus.create({
      data: {
        name: dto.name,
        sortOrder: order,
        phaseId: dto.phaseId,
        color: dto.color ?? null,
        rules: (dto.rules ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateStatus(id: number, dto: UpdateStatusDto) {
    const existing = await this.prisma.crmCustomerStatus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("CRM status not found");
    if (dto.phaseId) await this.ensurePhase(dto.phaseId);
    return this.prisma.crmCustomerStatus.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
        phaseId: dto.phaseId ?? undefined,
        color: dto.color ?? undefined,
        rules: (dto.rules ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async deleteStatus(id: number) {
    const existing = await this.prisma.crmCustomerStatus.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("CRM status not found");
    const count = await this.prisma.crmCustomerCard.count({ where: { statusId: id } });
    if (count > 0) {
      throw new BadRequestException("Status has customers assigned");
    }
    return this.prisma.crmCustomerStatus.delete({ where: { id } });
  }

  async listPhases() {
    return this.prisma.crmPhase.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  async createPhase(dto: CreatePhaseDto) {
    return this.prisma.crmPhase.create({
      data: {
        name: dto.name,
        sortOrder: dto.sortOrder ?? 0,
        color: dto.color ?? null,
      },
    });
  }

  async updatePhase(id: number, dto: UpdatePhaseDto) {
    const existing = await this.prisma.crmPhase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("CRM phase not found");
    return this.prisma.crmPhase.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        sortOrder: dto.sortOrder ?? existing.sortOrder,
        color: dto.color ?? existing.color,
      },
    });
  }

  async deletePhase(id: number) {
    const existing = await this.prisma.crmPhase.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("CRM phase not found");
    const statusCount = await this.prisma.crmCustomerStatus.count({
      where: { phaseId: id },
    });
    if (statusCount > 0) {
      throw new BadRequestException("Phase has statuses");
    }
    const cardCount = await this.prisma.crmCustomerCard.count({
      where: { phaseId: id },
    });
    if (cardCount > 0) {
      throw new BadRequestException("Phase has customers assigned");
    }
    return this.prisma.crmPhase.delete({ where: { id } });
  }

  async listAutomations() {
    return this.prisma.crmAutomation.findMany({ orderBy: { id: "asc" } });
  }

  async createAutomation(dto: CreateAutomationDto) {
    return this.prisma.crmAutomation.create({
      data: {
        name: dto.name,
        trigger: dto.trigger,
        conditions: dto.conditions as Prisma.InputJsonValue,
        actions: dto.actions as Prisma.InputJsonValue,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async updateAutomation(id: number, dto: UpdateAutomationDto) {
    const existing = await this.prisma.crmAutomation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automation not found");
    return this.prisma.crmAutomation.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        trigger: dto.trigger ?? undefined,
        conditions: (dto.conditions ?? undefined) as Prisma.InputJsonValue | undefined,
        actions: (dto.actions ?? undefined) as Prisma.InputJsonValue | undefined,
        enabled: dto.enabled ?? undefined,
      },
    });
  }

  async deleteAutomation(id: number) {
    const existing = await this.prisma.crmAutomation.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Automation not found");
    return this.prisma.crmAutomation.delete({ where: { id } });
  }

  async listNotifications(ownerId?: number) {
    return this.prisma.crmNotification.findMany({
      where: ownerId ? { ownerId } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async markNotificationRead(id: number, ownerId?: number) {
    const notification = await this.prisma.crmNotification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException("Notification not found");
    if (ownerId && notification.ownerId && notification.ownerId !== ownerId) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.crmNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async buildCrmExport() {
    const [
      customers,
      phases,
      statuses,
      cards,
      tasks,
      notes,
      events,
      templates,
      segments,
      automations,
    ] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        select: {
          id: true,
          type: true,
          name: true,
          taxId: true,
          city: true,
          email: true,
          phone: true,
          notes: true,
          active: true,
          createdAt: true,
        },
      }),
      this.prisma.crmPhase.findMany(),
      this.prisma.crmCustomerStatus.findMany(),
      this.prisma.crmCustomerCard.findMany(),
      this.prisma.crmTask.findMany(),
      this.prisma.crmNote.findMany(),
      this.prisma.crmEvent.findMany(),
      this.prisma.crmTaskTemplate.findMany(),
      this.prisma.crmSegment.findMany(),
      this.prisma.crmAutomation.findMany(),
    ]);

    const manifest: CrmExportManifest = {
      version: CRM_EXPORT_VERSION,
      createdAt: new Date().toISOString(),
    };

    return {
      manifest,
      customers,
      crm_phases: phases,
      crm_statuses: statuses,
      crm_cards: cards,
      crm_tasks: tasks,
      crm_notes: notes,
      crm_events: events,
      crm_task_templates: templates,
      crm_segments: segments,
      crm_automations: automations,
    };
  }

  async importCrmData(
    data: {
      manifest: CrmExportManifest;
      customers: Prisma.CustomerCreateManyInput[];
      crm_phases: Prisma.CrmPhaseCreateManyInput[];
      crm_statuses: Prisma.CrmCustomerStatusCreateManyInput[];
      crm_cards: Prisma.CrmCustomerCardCreateManyInput[];
      crm_tasks: Prisma.CrmTaskCreateManyInput[];
      crm_notes: Prisma.CrmNoteCreateManyInput[];
      crm_events: Prisma.CrmEventCreateManyInput[];
      crm_task_templates: Prisma.CrmTaskTemplateCreateManyInput[];
      crm_segments: Prisma.CrmSegmentCreateManyInput[];
      crm_automations: Prisma.CrmAutomationCreateManyInput[];
    },
    mode: "restore" | "merge",
  ) {
    if (!data?.manifest || data.manifest.version !== CRM_EXPORT_VERSION) {
      throw new BadRequestException("Invalid CRM export manifest version");
    }

    await this.prisma.$transaction(
      async (tx) => {
      const validUserIds = new Set(
        (await tx.user.findMany({ select: { id: true } })).map((u) => u.id),
      );

      const normalizeOwner = (ownerId?: number | null) =>
        ownerId && validUserIds.has(ownerId) ? ownerId : null;

      const customers = data.customers ?? [];
      const phases = data.crm_phases ?? [];
      const statuses = data.crm_statuses ?? [];
      const cards = (data.crm_cards ?? []).map((card) => ({
        ...card,
        ownerId: normalizeOwner(card.ownerId ?? null),
      }));
      const tasks = (data.crm_tasks ?? []).map((task) => ({
        ...task,
        ownerId: normalizeOwner(task.ownerId ?? null),
      }));
      const notes = (data.crm_notes ?? []).map((note) => ({
        ...note,
        ownerId: normalizeOwner(note.ownerId ?? null),
      }));
      const events = (data.crm_events ?? []).map((event) => ({
        ...event,
        ownerId: normalizeOwner(event.ownerId ?? null),
      }));
      const templates = data.crm_task_templates ?? [];
      const segments = data.crm_segments ?? [];
      const automations = data.crm_automations ?? [];

      if (mode === "restore") {
        await tx.crmCustomerCard.deleteMany();
        await tx.crmCustomerStatus.deleteMany();
        await tx.crmPhase.deleteMany();
        await tx.crmTask.deleteMany();
        await tx.crmNote.deleteMany();
        await tx.crmEvent.deleteMany();
        await tx.crmTaskTemplate.deleteMany();
        await tx.crmSegment.deleteMany();
        await tx.crmAutomation.deleteMany();
      }

      for (const customer of customers) {
        await tx.customer.upsert({
          where: { id: customer.id },
          update: { ...customer },
          create: { ...customer },
        });
      }

      for (const phase of phases) {
        await tx.crmPhase.upsert({
          where: { id: phase.id },
          update: { ...phase },
          create: { ...phase },
        });
      }

      for (const status of statuses) {
        await tx.crmCustomerStatus.upsert({
          where: { id: status.id },
          update: { ...status },
          create: { ...status },
        });
      }

      for (const card of cards) {
        await tx.crmCustomerCard.upsert({
          where: { id: card.id },
          update: { ...card },
          create: { ...card },
        });
      }

      for (const task of tasks) {
        await tx.crmTask.upsert({
          where: { id: task.id },
          update: { ...task },
          create: { ...task },
        });
      }

      for (const note of notes) {
        await tx.crmNote.upsert({
          where: { id: note.id },
          update: { ...note },
          create: { ...note },
        });
      }

      for (const event of events) {
        await tx.crmEvent.upsert({
          where: { id: event.id },
          update: { ...event },
          create: { ...event },
        });
      }

      for (const template of templates) {
        await tx.crmTaskTemplate.upsert({
          where: { id: template.id },
          update: { ...template },
          create: { ...template },
        });
      }

      for (const segment of segments) {
        await tx.crmSegment.upsert({
          where: { id: segment.id },
          update: { ...segment },
          create: { ...segment },
        });
      }

      for (const automation of automations) {
        await tx.crmAutomation.upsert({
          where: { id: automation.id },
          update: { ...automation },
          create: { ...automation },
        });
      }
      },
      { maxWait: 120000, timeout: 120000 },
    );

    return { mode, imported: true };
  }

  private async resolveSegmentCustomers(segment: { filters: Prisma.JsonValue }) {
    const filters = (segment.filters ?? {}) as Record<string, unknown>;
    const where: Prisma.CustomerWhereInput = {};

    if (typeof filters.q === "string" && filters.q.trim()) {
      const term = filters.q.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
        { taxId: { contains: term, mode: "insensitive" } },
      ];
    }

    if (typeof filters.active === "boolean") {
      where.active = filters.active;
    }

    const cardFilter: Prisma.CrmCustomerCardWhereInput = {};
    if (typeof filters.statusId === "number") {
      cardFilter.statusId = filters.statusId;
    }
    if (typeof filters.ownerId === "number") {
      cardFilter.ownerId = filters.ownerId;
    }
    if (typeof filters.tag === "string" && filters.tag.trim()) {
      cardFilter.tags = { has: filters.tag.trim() };
    }
    if (Object.keys(cardFilter).length > 0) {
      where.crmCard = { is: cardFilter };
    }

    if (typeof filters.city === "string" && filters.city.trim()) {
      where.city = { contains: filters.city.trim(), mode: "insensitive" };
    }

    const customers = await this.prisma.customer.findMany({
      where,
      include: { crmCard: true },
      orderBy: { name: "asc" },
    });

    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length === 0) {
      return customers;
    }

    type CustomerStats = {
      customerId: number;
      total: number;
      count: number;
      lastDate: Date | null;
      avgTicket: number;
      returnsCount: number;
      channels: string[] | null;
    };

    const saleTypes = Prisma.join([
      StockMoveType.b2b_sale,
      StockMoveType.b2c_sale,
    ]);
    const returnTypes = Prisma.join([
      StockMoveType.b2b_return,
      StockMoveType.b2c_return,
    ]);

    const statsRows = await this.prisma.$queryRaw<CustomerStats[]>`
      SELECT
        m."customerId" as "customerId",
        COALESCE(SUM(
          CASE WHEN m."type"::text IN (${saleTypes})
            THEN l."quantity" * COALESCE(l."unitPrice", 0)
            ELSE 0
          END
        ), 0) as "total",
        COUNT(DISTINCT CASE WHEN m."type"::text IN (${saleTypes}) THEN m."id" END) as "count",
        MAX(CASE WHEN m."type"::text IN (${saleTypes}) THEN m."date" END) as "lastDate",
        COALESCE(
          COALESCE(SUM(
            CASE WHEN m."type"::text IN (${saleTypes})
              THEN l."quantity" * COALESCE(l."unitPrice", 0)
              ELSE 0
            END
          ), 0) /
          NULLIF(COUNT(DISTINCT CASE WHEN m."type"::text IN (${saleTypes}) THEN m."id" END), 0),
          0
        ) as "avgTicket",
        COUNT(DISTINCT CASE WHEN m."type"::text IN (${returnTypes}) THEN m."id" END) as "returnsCount",
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT CASE WHEN m."type"::text IN (${saleTypes}) THEN m."channel" END),
          NULL
        ) as "channels"
      FROM "StockMove" m
      LEFT JOIN "StockMoveLine" l ON l."moveId" = m."id"
      WHERE m."customerId" IN (${Prisma.join(customerIds)})
      GROUP BY m."customerId"
    `;

    const statsByCustomer = new Map<number, CustomerStats>();
    for (const row of statsRows) {
      statsByCustomer.set(row.customerId, {
        customerId: Number(row.customerId),
        total: Number(row.total ?? 0),
        count: Number(row.count ?? 0),
        lastDate: row.lastDate ? new Date(row.lastDate) : null,
        avgTicket: Number(row.avgTicket ?? 0),
        returnsCount: Number(row.returnsCount ?? 0),
        channels: row.channels ?? [],
      });
    }

    const lastPurchaseDays =
      typeof filters.lastPurchaseDays === "number"
        ? filters.lastPurchaseDays
        : null;
    const totalSpentMin =
      typeof filters.totalSpentMin === "number"
        ? filters.totalSpentMin
        : null;
    const avgTicketMin =
      typeof filters.avgTicketMin === "number"
        ? filters.avgTicketMin
        : null;
    const purchaseCountMin =
      typeof filters.purchaseCountMin === "number"
        ? filters.purchaseCountMin
        : null;
    const returnsCountMin =
      typeof filters.returnsCountMin === "number"
        ? filters.returnsCountMin
        : null;
    const channelFilter =
      typeof filters.channel === "string" && filters.channel.trim()
        ? filters.channel.trim().toUpperCase()
        : null;

    const now = new Date();

    return customers.filter((customer) => {
      const stats = statsByCustomer.get(customer.id) ?? {
        customerId: customer.id,
        total: 0,
        count: 0,
        lastDate: null,
        avgTicket: 0,
        returnsCount: 0,
        channels: [],
      };

      if (lastPurchaseDays !== null) {
        if (!stats.lastDate) {
          // keep customers without purchases in "older than" segments
        } else {
          const diffMs = now.getTime() - stats.lastDate.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          if (diffDays < lastPurchaseDays) return false;
        }
      }

      if (totalSpentMin !== null && stats.total < totalSpentMin) {
        return false;
      }

      if (avgTicketMin !== null && stats.avgTicket < avgTicketMin) {
        return false;
      }

      if (purchaseCountMin !== null && stats.count < purchaseCountMin) {
        return false;
      }

      if (returnsCountMin !== null && stats.returnsCount < returnsCountMin) {
        return false;
      }

      if (channelFilter) {
        const channels = (stats.channels ?? []).map((value) =>
          String(value).toUpperCase(),
        );
        if (!channels.includes(channelFilter)) return false;
      }

      return true;
    });
  }

  private async getTask(id: number) {
    const task = await this.prisma.crmTask.findUnique({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    return task;
  }

  private async getEvent(id: number) {
    const event = await this.prisma.crmEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException("Event not found");
    return event;
  }

  private async resolvePhaseId(phaseId?: number) {
    if (phaseId) return phaseId;
    const phase = await this.prisma.crmPhase.findFirst({
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    if (!phase) throw new NotFoundException("CRM phase not found");
    return phase.id;
  }

  private async ensurePhase(phaseId?: number) {
    if (!phaseId) return;
    const phase = await this.prisma.crmPhase.findUnique({
      where: { id: phaseId },
      select: { id: true },
    });
    if (!phase) throw new NotFoundException("CRM phase not found");
  }

  private async ensureCustomer(customerId?: number) {
    if (!customerId) return;
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
  }

  private async ensureOpportunity(opportunityId?: number) {
    if (!opportunityId) return;
    const opportunity = await this.prisma.crmOpportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opportunity) throw new NotFoundException("Opportunity not found");
  }
}
