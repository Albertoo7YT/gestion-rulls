import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { CrmAutomationService } from "../crm/crm-automation.service";

@Injectable()
export class CrmAutomationScheduleService {
  private readonly logger = new Logger(CrmAutomationScheduleService.name);

  constructor(private readonly automations: CrmAutomationService) {}

  @Cron("0 10 3 * * *", { timeZone: "Europe/Madrid" })
  async runDaily() {
    try {
      await this.automations.runDailyScheduler();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`CRM daily scheduler failed: ${message}`);
    }
  }
}
