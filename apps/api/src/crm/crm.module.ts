import { Module } from "@nestjs/common";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { CrmAutomationService } from "./crm-automation.service";
import { PosModule } from "../pos/pos.module";

@Module({
  imports: [PosModule],
  controllers: [CrmController],
  providers: [CrmService, CrmAutomationService],
  exports: [CrmAutomationService],
})
export class CrmModule {}
