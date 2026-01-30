import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
const AdmZip = require("adm-zip");
import { ExportImportService } from "./export-import.service";
import { ImportQueryDto } from "./dto/import-query.dto";

@Controller()
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ExportImportController {
  constructor(private readonly exportImportService: ExportImportService) {}

  @Get("export")
  async exportAll(@Res() res: Response) {
    const data = await this.exportImportService.buildExport();
    const zip = new AdmZip();

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(data.manifest)));
    zip.addFile("customers.json", Buffer.from(JSON.stringify(data.customers)));
    zip.addFile("users.json", Buffer.from(JSON.stringify(data.users)));
    zip.addFile("audit_logs.json", Buffer.from(JSON.stringify(data.audit_logs)));
    zip.addFile("products.json", Buffer.from(JSON.stringify(data.products)));
    zip.addFile("categories.json", Buffer.from(JSON.stringify(data.categories)));
    zip.addFile(
      "product_categories.json",
      Buffer.from(JSON.stringify(data.product_categories)),
    );
    zip.addFile("suppliers.json", Buffer.from(JSON.stringify(data.suppliers)));
    zip.addFile(
      "price_rules.json",
      Buffer.from(JSON.stringify(data.price_rules)),
    );
    zip.addFile(
      "payment_methods.json",
      Buffer.from(JSON.stringify(data.payment_methods)),
    );
    zip.addFile(
      "purchase_orders.json",
      Buffer.from(JSON.stringify(data.purchase_orders)),
    );
    zip.addFile(
      "purchase_order_lines.json",
      Buffer.from(JSON.stringify(data.purchase_order_lines)),
    );
    zip.addFile("locations.json", Buffer.from(JSON.stringify(data.locations)));
    zip.addFile(
      "stock_moves.json",
      Buffer.from(JSON.stringify(data.stock_moves)),
    );
    zip.addFile(
      "stock_move_lines.json",
      Buffer.from(JSON.stringify(data.stock_move_lines)),
    );
    zip.addFile("accessories.json", Buffer.from(JSON.stringify(data.accessories)));
    zip.addFile(
      "document_series.json",
      Buffer.from(JSON.stringify(data.document_series)),
    );
    zip.addFile("web_orders.json", Buffer.from(JSON.stringify(data.web_orders)));
    zip.addFile(
      "web_order_lines.json",
      Buffer.from(JSON.stringify(data.web_order_lines)),
    );
    zip.addFile("settings.json", Buffer.from(JSON.stringify(data.settings)));
    zip.addFile("crm_phases.json", Buffer.from(JSON.stringify(data.crm_phases)));
    zip.addFile(
      "crm_statuses.json",
      Buffer.from(JSON.stringify(data.crm_statuses)),
    );
    zip.addFile("crm_cards.json", Buffer.from(JSON.stringify(data.crm_cards)));
    zip.addFile("crm_tasks.json", Buffer.from(JSON.stringify(data.crm_tasks)));
    zip.addFile("crm_notes.json", Buffer.from(JSON.stringify(data.crm_notes)));
    zip.addFile("crm_events.json", Buffer.from(JSON.stringify(data.crm_events)));
    zip.addFile(
      "crm_task_templates.json",
      Buffer.from(JSON.stringify(data.crm_task_templates)),
    );
    zip.addFile(
      "crm_segments.json",
      Buffer.from(JSON.stringify(data.crm_segments)),
    );
    zip.addFile(
      "crm_automations.json",
      Buffer.from(JSON.stringify(data.crm_automations)),
    );
    zip.addFile(
      "crm_automation_runs.json",
      Buffer.from(JSON.stringify(data.crm_automation_runs)),
    );
    zip.addFile(
      "crm_notifications.json",
      Buffer.from(JSON.stringify(data.crm_notifications)),
    );
    zip.addFile(
      "crm_opportunities.json",
      Buffer.from(JSON.stringify(data.crm_opportunities)),
    );
    zip.addFile(
      "cash_closures.json",
      Buffer.from(JSON.stringify(data.cash_closures)),
    );

    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=export.zip");
    res.send(buffer);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  async importAll(
    @Query() query: ImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file");
    }

    const zip = new AdmZip(file.buffer);
    const manifest = this.readJson(zip, "manifest.json");
    const customers = this.readJsonOptional(zip, "customers.json") ?? [];
    const users = this.readJsonOptional(zip, "users.json") ?? [];
    const audit_logs = this.readJsonOptional(zip, "audit_logs.json") ?? [];
    const products = this.readJson(zip, "products.json");
    const categories = this.readJsonOptional(zip, "categories.json") ?? [];
    const product_categories =
      this.readJsonOptional(zip, "product_categories.json") ?? [];
    const suppliers = this.readJsonOptional(zip, "suppliers.json") ?? [];
    const price_rules = this.readJsonOptional(zip, "price_rules.json") ?? [];
    const payment_methods =
      this.readJsonOptional(zip, "payment_methods.json") ?? [];
    const purchase_orders =
      this.readJsonOptional(zip, "purchase_orders.json") ?? [];
    const purchase_order_lines =
      this.readJsonOptional(zip, "purchase_order_lines.json") ?? [];
    const locations = this.readJson(zip, "locations.json");
    const stock_moves = this.readJson(zip, "stock_moves.json");
    const stock_move_lines = this.readJson(zip, "stock_move_lines.json");
    const accessories = this.readJsonOptional(zip, "accessories.json") ?? [];
    const document_series =
      this.readJsonOptional(zip, "document_series.json") ?? [];
    const web_orders = this.readJson(zip, "web_orders.json");
    const web_order_lines = this.readJson(zip, "web_order_lines.json");
    const settings = this.readJson(zip, "settings.json");
    const crm_phases = this.readJsonOptional(zip, "crm_phases.json") ?? [];
    const crm_statuses = this.readJsonOptional(zip, "crm_statuses.json") ?? [];
    const crm_cards = this.readJsonOptional(zip, "crm_cards.json") ?? [];
    const crm_tasks = this.readJsonOptional(zip, "crm_tasks.json") ?? [];
    const crm_notes = this.readJsonOptional(zip, "crm_notes.json") ?? [];
    const crm_events = this.readJsonOptional(zip, "crm_events.json") ?? [];
    const crm_task_templates =
      this.readJsonOptional(zip, "crm_task_templates.json") ?? [];
    const crm_segments = this.readJsonOptional(zip, "crm_segments.json") ?? [];
    const crm_automations =
      this.readJsonOptional(zip, "crm_automations.json") ?? [];
    const crm_automation_runs =
      this.readJsonOptional(zip, "crm_automation_runs.json") ?? [];
    const crm_notifications =
      this.readJsonOptional(zip, "crm_notifications.json") ?? [];
    const crm_opportunities =
      this.readJsonOptional(zip, "crm_opportunities.json") ?? [];
    const cash_closures =
      this.readJsonOptional(zip, "cash_closures.json") ?? [];

    return this.exportImportService.importData(
      {
        manifest,
        customers,
        users,
        audit_logs,
        products,
        categories,
        product_categories,
        suppliers,
        price_rules,
        payment_methods,
        purchase_orders,
        purchase_order_lines,
        locations,
        stock_moves,
        stock_move_lines,
        accessories,
        document_series,
        web_orders,
        web_order_lines,
        settings,
        crm_phases,
        crm_statuses,
        crm_cards,
        crm_tasks,
        crm_notes,
        crm_events,
        crm_task_templates,
        crm_segments,
        crm_automations,
        crm_automation_runs,
        crm_notifications,
        crm_opportunities,
        cash_closures,
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

  private readJsonOptional(zip: any, name: string) {
    const entry = zip.getEntry(name);
    if (!entry) {
      return null;
    }
    const raw = entry.getData().toString("utf-8");
    return JSON.parse(raw);
  }
}
