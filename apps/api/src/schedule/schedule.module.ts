import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { WooImportModule } from "../woo-import/woo-import.module";
import { BackupModule } from "../backup/backup.module";
import { WooSyncService } from "./woo-sync.service";
import { BackupScheduleService } from "./backup-schedule.service";

@Module({
  imports: [ScheduleModule.forRoot(), WooImportModule, BackupModule],
  providers: [WooSyncService, BackupScheduleService],
})
export class AppScheduleModule {}
