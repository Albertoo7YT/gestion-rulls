import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { WooImportService } from "../woo-import/woo-import.service";

@Injectable()
export class WooSyncService {
  private readonly logger = new Logger(WooSyncService.name);

  constructor(private readonly wooImportService: WooImportService) {}

  @Cron("0 3 * * *", { timeZone: "Europe/Madrid" })
  async syncDaily() {
    try {
      await this.wooImportService.importOrders({ includePending: false });
    } catch (error) {
      this.logger.error("Woo daily sync failed", error as Error);
    }
  }
}
