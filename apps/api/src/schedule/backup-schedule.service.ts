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

  @Cron("0 0 4 * * 0", { timeZone: "Europe/Madrid" })
  async handleWeeklyRestoreTest() {
    try {
      const result = await this.backupService.verifyLatestBackup();
      if (!result) {
        this.logger.warn("Weekly restore test skipped: no backups found");
        return;
      }
      if (!result.verified) {
        this.logger.error(`Weekly restore test failed: ${result.name}`);
      }
    } catch (err) {
      this.logger.error("Weekly restore test failed", err as Error);
    }
  }
}
