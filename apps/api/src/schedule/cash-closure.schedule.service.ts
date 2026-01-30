import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ReportsService } from "../reports/reports.service";

@Injectable()
export class CashClosureScheduleService {
  private readonly logger = new Logger(CashClosureScheduleService.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Cron("0 5 0 * * *", { timeZone: "Europe/Madrid" })
  async runDailyClosure() {
    try {
      const now = new Date();
      const date = new Date(now);
      date.setDate(now.getDate() - 1);
      await this.reportsService.createDailyClosure(date);
    } catch (err) {
      this.logger.error(
        `Daily cash closure failed: ${String(err)}`,
        err as Error,
      );
    }
  }
}
