import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PosController } from "./pos.controller";
import { PosService } from "./pos.service";
import { SeriesService } from "../common/series.service";

@Module({
  imports: [AuditModule],
  controllers: [PosController],
  providers: [PosService, SeriesService],
  exports: [PosService],
})
export class PosModule {}
