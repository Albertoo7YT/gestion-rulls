import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SeriesService } from "../common/series.service";
import { MovesController } from "./moves.controller";
import { MovesService } from "./moves.service";

@Module({
  imports: [AuditModule],
  controllers: [MovesController],
  providers: [MovesService, SeriesService],
  exports: [MovesService],
})
export class MovesModule {}
