import { Module } from "@nestjs/common";
import { WooImportController } from "./woo-import.controller";
import { WooImportService } from "./woo-import.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [WooImportController],
  providers: [WooImportService],
  exports: [WooImportService],
})
export class WooImportModule {}
