import { Module } from "@nestjs/common";
import { WebOrdersController } from "./web-orders.controller";
import { WebOrdersService } from "./web-orders.service";

@Module({
  controllers: [WebOrdersController],
  providers: [WebOrdersService],
})
export class WebOrdersModule {}
