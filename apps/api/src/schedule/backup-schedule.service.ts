import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { BackupService } from "../backup/backup.service";

@Injectable()
export class BackupScheduleService {
  private readonly logger = new Logger(BackupScheduleService.name);

  constructor(private readonly backupService: BackupService) {}

  @Cron("0 30 2 * * *", { timeZone: "Europe/Madrid" })
  async handleDailyBackup() {
    try {
      await this.backupService.runBackup();
    } catch (err) {
      this.logger.error("Daily backup failed", err as Error);
    }
  }
}
