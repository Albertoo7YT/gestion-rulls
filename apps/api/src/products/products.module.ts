import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AccessoriesController } from "./accessories.controller";
import { AccessoriesService } from "./accessories.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuditModule],
  controllers: [ProductsController, AccessoriesController],
  providers: [ProductsService, AccessoriesService],
})
export class ProductsModule {}
