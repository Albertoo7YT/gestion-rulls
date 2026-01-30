import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { Response } from "express";
const AdmZip = require("adm-zip");
import { Permissions } from "../auth/permissions.decorator";
import { CrmService } from "./crm.service";
import { ImportQueryDto } from "../export-import/dto/import-query.dto";
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
import { CreateOrderDto } from "./dto/create-order.dto";
import { CreatePhaseDto } from "./dto/create-phase.dto";
import { UpdatePhaseDto } from "./dto/update-phase.dto";
import { CreateStatusDto } from "./dto/create-status.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { CreateAutomationDto } from "./dto/create-automation.dto";
import { UpdateAutomationDto } from "./dto/update-automation.dto";

@Controller("crm")
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get("board")
  @Permissions("crm.view")
  listBoard(@Query() query: ListBoardQueryDto) {
    return this.crm.listBoard(query);
  }

  @Post("board/move")
  @Permissions("crm.manage")
  moveBoard(@Body() dto: MoveBoardDto) {
    return this.crm.moveBoard(dto);
  }

  @Get("customers/:id/summary")
  @Permissions("crm.view")
  customerSummary(@Param("id", ParseIntPipe) id: number) {
    return this.crm.customerSummary(id);
  }

  @Get("customers/:id/orders")
  @Permissions("crm.view")
  customerOrders(@Param("id", ParseIntPipe) id: number) {
    return this.crm.listCustomerOrders(id);
  }

  @Get("tasks")
  @Permissions("crm.view")
  listTasks(@Query() query: ListTasksQueryDto) {
    return this.crm.listTasks(query);
  }

  @Post("tasks")
  @Permissions("crm.tasks.manage")
  createTask(@Body() dto: CreateTaskDto) {
    return this.crm.createTask(dto);
  }

  @Patch("tasks/:id")
  @Permissions("crm.tasks.manage")
  updateTask(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.crm.updateTask(id, dto);
  }

  @Delete("tasks/:id")
  @Permissions("crm.tasks.manage")
  deleteTask(@Param("id", ParseIntPipe) id: number) {
    return this.crm.deleteTask(id);
  }

  @Post("tasks/bulk")
  @Permissions("crm.tasks.manage")
  bulkCreateTasks(@Body() dto: BulkCreateTasksDto) {
    return this.crm.bulkCreateTasks(dto);
  }

  @Get("calendar")
  @Permissions("crm.view")
  listCalendar(@Query() query: ListCalendarQueryDto) {
    return this.crm.listCalendar(query);
  }

  @Post("calendar")
  @Permissions("crm.manage")
  createEvent(@Body() dto: CreateEventDto) {
    return this.crm.createEvent(dto);
  }

  @Patch("calendar/:id")
  @Permissions("crm.manage")
  updateEvent(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateEventDto,
  ) {
    return this.crm.updateEvent(id, dto);
  }

  @Get("customers/:id/timeline")
  @Permissions("crm.view")
  getTimeline(@Param("id", ParseIntPipe) id: number) {
    return this.crm.getTimeline(id);
  }

  @Post("customers/:id/notes")
  @Permissions("crm.manage")
  createNote(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateNoteDto,
    @Req() req: Request & { user?: { id?: number } },
  ) {
    return this.crm.createNote(id, dto, req.user?.id);
  }

  @Post("customers/:id/create-order")
  @Permissions("crm.manage")
  createOrder(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateOrderDto,
    @Req() req: Request & { user?: { id?: number } },
  ) {
    return this.crm.createOrderForCustomer(id, dto, req.user?.id);
  }

  @Get("segments")
  @Permissions("crm.view")
  listSegments() {
    return this.crm.listSegments();
  }

  @Post("segments")
  @Permissions("crm.manage")
  createSegment(@Body() dto: CreateSegmentDto) {
    return this.crm.createSegment(dto);
  }

  @Get("segments/:id/customers")
  @Permissions("crm.view")
  listSegmentCustomers(@Param("id", ParseIntPipe) id: number) {
    return this.crm.listSegmentCustomers(id);
  }

  @Get("statuses")
  @Permissions("crm.view")
  listStatuses(@Query("phase") phase?: string) {
    const phaseId = phase ? Number(phase) : undefined;
    return this.crm.listStatuses(phaseId);
  }

  @Get("phases")
  @Permissions("crm.view")
  listPhases() {
    return this.crm.listPhases();
  }

  @Post("phases")
  @Permissions("crm.manage")
  createPhase(@Body() dto: CreatePhaseDto) {
    return this.crm.createPhase(dto);
  }

  @Patch("phases/:id")
  @Permissions("crm.manage")
  updatePhase(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.crm.updatePhase(id, dto);
  }

  @Delete("phases/:id")
  @Permissions("crm.manage")
  deletePhase(@Param("id", ParseIntPipe) id: number) {
    return this.crm.deletePhase(id);
  }

  @Post("statuses")
  @Permissions("crm.admin")
  createStatus(@Body() dto: CreateStatusDto) {
    return this.crm.createStatus(dto);
  }

  @Patch("statuses/:id")
  @Permissions("crm.admin")
  updateStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.crm.updateStatus(id, dto);
  }

  @Patch("statuses/:id/delete")
  @Permissions("crm.admin")
  deleteStatus(@Param("id", ParseIntPipe) id: number) {
    return this.crm.deleteStatus(id);
  }

  @Get("automations")
  @Permissions("crm.admin")
  listAutomations() {
    return this.crm.listAutomations();
  }

  @Post("automations")
  @Permissions("crm.admin")
  createAutomation(@Body() dto: CreateAutomationDto) {
    return this.crm.createAutomation(dto);
  }

  @Patch("automations/:id")
  @Permissions("crm.admin")
  updateAutomation(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateAutomationDto,
  ) {
    return this.crm.updateAutomation(id, dto);
  }

  @Patch("automations/:id/delete")
  @Permissions("crm.admin")
  deleteAutomation(@Param("id", ParseIntPipe) id: number) {
    return this.crm.deleteAutomation(id);
  }

  @Get("notifications")
  @Permissions("crm.view")
  listNotifications(@Req() req: Request & { user?: { id?: number } }) {
    return this.crm.listNotifications(req.user?.id);
  }

  @Patch("notifications/:id/read")
  @Permissions("crm.view")
  markNotificationRead(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: Request & { user?: { id?: number } },
  ) {
    return this.crm.markNotificationRead(id, req.user?.id);
  }

  @Get("export")
  @Permissions("crm.admin")
  async exportCrm(@Res() res: Response) {
    const data = await this.crm.buildCrmExport();
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(data.manifest)));
    zip.addFile("customers.json", Buffer.from(JSON.stringify(data.customers)));
    zip.addFile("crm_phases.json", Buffer.from(JSON.stringify(data.crm_phases)));
    zip.addFile("crm_statuses.json", Buffer.from(JSON.stringify(data.crm_statuses)));
    zip.addFile("crm_cards.json", Buffer.from(JSON.stringify(data.crm_cards)));
    zip.addFile("crm_tasks.json", Buffer.from(JSON.stringify(data.crm_tasks)));
    zip.addFile("crm_notes.json", Buffer.from(JSON.stringify(data.crm_notes)));
    zip.addFile("crm_events.json", Buffer.from(JSON.stringify(data.crm_events)));
    zip.addFile(
      "crm_task_templates.json",
      Buffer.from(JSON.stringify(data.crm_task_templates)),
    );
    zip.addFile("crm_segments.json", Buffer.from(JSON.stringify(data.crm_segments)));
    zip.addFile(
      "crm_automations.json",
      Buffer.from(JSON.stringify(data.crm_automations)),
    );

    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=crm-export.zip");
    res.send(buffer);
  }

  @Post("import")
  @Permissions("crm.admin")
  @UseInterceptors(FileInterceptor("file"))
  async importCrm(
    @Query() query: ImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file");
    }
    const zip = new AdmZip(file.buffer);
    const manifest = this.readJson(zip, "manifest.json");
    const customers = this.readJson(zip, "customers.json");
    const crm_phases = this.readJson(zip, "crm_phases.json");
    const crm_statuses = this.readJson(zip, "crm_statuses.json");
    const crm_cards = this.readJson(zip, "crm_cards.json");
    const crm_tasks = this.readJson(zip, "crm_tasks.json");
    const crm_notes = this.readJson(zip, "crm_notes.json");
    const crm_events = this.readJson(zip, "crm_events.json");
    const crm_task_templates = this.readJson(zip, "crm_task_templates.json");
    const crm_segments = this.readJson(zip, "crm_segments.json");
    const crm_automations = this.readJson(zip, "crm_automations.json");

    return this.crm.importCrmData(
      {
        manifest,
        customers,
        crm_phases,
        crm_statuses,
        crm_cards,
        crm_tasks,
        crm_notes,
        crm_events,
        crm_task_templates,
        crm_segments,
        crm_automations,
      },
      query.mode,
    );
  }

  private readJson(zip: any, name: string) {
    const entry = zip.getEntry(name);
    if (!entry) {
      throw new BadRequestException(`Missing ${name} in zip`);
    }
    const raw = entry.getData().toString("utf-8");
    return JSON.parse(raw);
  }
}
