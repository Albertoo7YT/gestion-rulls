import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExportImportService } from "../export-import/export-import.service";
import * as fs from "fs/promises";
import * as path from "path";
const AdmZip = require("adm-zip");

type BackupInfo = {
  name: string;
  size: number;
  createdAt: string;
};

type BackupVerifyResult = {
  name: string;
  verified: boolean;
  message?: string;
};

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly exportImportService: ExportImportService,
    private readonly configService: ConfigService,
  ) {}

  async runBackup(): Promise<BackupInfo> {
    const backupDir = this.getBackupDir();
    await fs.mkdir(backupDir, { recursive: true });

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
    const name = `backup-${this.timestamp()}.zip`;
    const fullPath = path.join(backupDir, name);
    await fs.writeFile(fullPath, buffer);

    const info = {
      name,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };

    this.logger.log(`Backup saved: ${name} (${buffer.length} bytes)`);
    return info;
  }

  async listBackups(): Promise<BackupInfo[]> {
    const backupDir = this.getBackupDir();
    try {
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile());
      const infos = await Promise.all(
        files.map(async (entry) => {
          const fullPath = path.join(backupDir, entry.name);
          const stats = await fs.stat(fullPath);
          return {
            name: entry.name,
            size: stats.size,
            createdAt: stats.mtime.toISOString(),
          };
        }),
      );
      return infos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    } catch (err) {
      return [];
    }
  }

  async getBackupPath(name: string) {
    const backupDir = this.getBackupDir();
    const fullPath = path.join(backupDir, name);
    await fs.access(fullPath);
    return fullPath;
  }

  async verifyLatestBackup(): Promise<BackupVerifyResult | null> {
    const backups = await this.listBackups();
    if (backups.length === 0) return null;
    return this.verifyBackup(backups[0].name);
  }

  async verifyBackup(name: string): Promise<BackupVerifyResult> {
    const fullPath = await this.getBackupPath(name);
    const buffer = await fs.readFile(fullPath);
    try {
      const data = this.readBackupZip(buffer);
      await this.exportImportService.verifyRestore(data);
    } catch (err) {
      const message = String(err);
      if (message.includes("VERIFY_RESTORE_ROLLBACK")) {
        this.logger.log(`Backup verify OK (restore test): ${name}`);
        return { name, verified: true };
      }
      this.logger.error(`Backup verify failed: ${name}`, err as Error);
      return { name, verified: false, message };
    }
    this.logger.log(`Backup verify OK (restore test): ${name}`);
    return { name, verified: true };
  }

  private getBackupDir() {
    return (
      this.configService.get<string>("BACKUP_DIR") ||
      path.join(process.cwd(), "backups")
    );
  }

  private timestamp() {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      "-" +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  private readBackupZip(buffer: Buffer) {
    const zip = new AdmZip(buffer);
    const getJson = (filename: string) => {
      const entry = zip.getEntry(filename);
      if (!entry) throw new Error(`Missing ${filename} in backup`);
      const raw = entry.getData().toString("utf-8");
      return JSON.parse(raw);
    };
    return {
      manifest: getJson("manifest.json"),
      customers: getJson("customers.json"),
      users: getJson("users.json"),
      audit_logs: getJson("audit_logs.json"),
      products: getJson("products.json"),
      categories: getJson("categories.json"),
      product_categories: getJson("product_categories.json"),
      suppliers: getJson("suppliers.json"),
      price_rules: getJson("price_rules.json"),
      payment_methods: getJson("payment_methods.json"),
      purchase_orders: getJson("purchase_orders.json"),
      purchase_order_lines: getJson("purchase_order_lines.json"),
      locations: getJson("locations.json"),
      stock_moves: getJson("stock_moves.json"),
      stock_move_lines: getJson("stock_move_lines.json"),
      accessories: getJson("accessories.json"),
      document_series: getJson("document_series.json"),
      web_orders: getJson("web_orders.json"),
      web_order_lines: getJson("web_order_lines.json"),
      settings: getJson("settings.json"),
      crm_phases: getJson("crm_phases.json"),
      crm_statuses: getJson("crm_statuses.json"),
      crm_cards: getJson("crm_cards.json"),
      crm_tasks: getJson("crm_tasks.json"),
      crm_notes: getJson("crm_notes.json"),
      crm_events: getJson("crm_events.json"),
      crm_task_templates: getJson("crm_task_templates.json"),
      crm_segments: getJson("crm_segments.json"),
      crm_automations: getJson("crm_automations.json"),
      crm_automation_runs: getJson("crm_automation_runs.json"),
      crm_notifications: getJson("crm_notifications.json"),
      crm_opportunities: getJson("crm_opportunities.json"),
      cash_closures: getJson("cash_closures.json"),
    };
  }
}
