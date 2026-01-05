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
    zip.addFile("products.json", Buffer.from(JSON.stringify(data.products)));
    zip.addFile("locations.json", Buffer.from(JSON.stringify(data.locations)));
    zip.addFile(
      "stock_moves.json",
      Buffer.from(JSON.stringify(data.stock_moves)),
    );
    zip.addFile(
      "stock_move_lines.json",
      Buffer.from(JSON.stringify(data.stock_move_lines)),
    );
    zip.addFile("web_orders.json", Buffer.from(JSON.stringify(data.web_orders)));
    zip.addFile(
      "web_order_lines.json",
      Buffer.from(JSON.stringify(data.web_order_lines)),
    );
    zip.addFile("settings.json", Buffer.from(JSON.stringify(data.settings)));

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
}
