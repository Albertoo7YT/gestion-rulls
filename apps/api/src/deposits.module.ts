import { Module } from "@nestjs/common";
import { DepositsController } from "./deposits.controller";
import { DepositsService } from "./deposits.service";
import { AuditModule } from "./audit/audit.module";
import { MovesModule } from "./moves/moves.module";
import { SeriesService } from "./common/series.service";

@Module({
  imports: [AuditModule, MovesModule],
  controllers: [DepositsController],
  providers: [DepositsService, SeriesService],
})
export class DepositsModule {}
