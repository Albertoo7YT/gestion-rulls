import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AssignWarehouseDto } from "./dto/assign-warehouse.dto";
import { ProcessWebOrderDto } from "./dto/process-web-order.dto";
import { WebOrdersService } from "./web-orders.service";

@Controller("web-orders")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class WebOrdersController {
  constructor(private readonly webOrdersService: WebOrdersService) {}

  @Get()
  list() {
    return this.webOrdersService.listOrders();
  }

  @Get(":wooOrderId")
  getOne(@Param("wooOrderId") wooOrderId: string) {
    return this.webOrdersService.getOrder(wooOrderId);
  }

  @Post(":wooOrderId/assign-warehouse")
  assignWarehouse(
    @Param("wooOrderId") wooOrderId: string,
    @Body() body: AssignWarehouseDto,
  ) {
    return this.webOrdersService.assignWarehouse(wooOrderId, body.warehouseId);
  }

  @Post(":wooOrderId/process")
  process(
    @Param("wooOrderId") wooOrderId: string,
    @Body() body: ProcessWebOrderDto,
  ) {
    return this.webOrdersService.processOrder(wooOrderId, body);
  }

  @Post(":wooOrderId/mark-completed")
  markCompleted(@Param("wooOrderId") wooOrderId: string) {
    return this.webOrdersService.markCompleted(wooOrderId);
  }

  @Delete(":wooOrderId")
  remove(@Param("wooOrderId") wooOrderId: string) {
    return this.webOrdersService.removeOrder(wooOrderId);
  }

  @Post("reconcile")
  reconcile() {
    return this.webOrdersService.reconcileProcessedOrders();
  }
}
