import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { WooImportModule } from "../woo-import/woo-import.module";
import { BackupModule } from "../backup/backup.module";
import { CrmModule } from "../crm/crm.module";
import { ReportsModule } from "../reports/reports.module";
import { WooSyncService } from "./woo-sync.service";
import { BackupScheduleService } from "./backup-schedule.service";
import { CrmAutomationScheduleService } from "./crm-automation.schedule.service";
import { CashClosureScheduleService } from "./cash-closure.schedule.service";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    WooImportModule,
    BackupModule,
    CrmModule,
    ReportsModule,
  ],
  providers: [
    WooSyncService,
    BackupScheduleService,
    CrmAutomationScheduleService,
    CashClosureScheduleService,
  ],
})
export class AppScheduleModule {}
