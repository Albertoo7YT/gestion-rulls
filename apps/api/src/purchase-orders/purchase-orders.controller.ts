import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { ReceivePurchaseOrderDto } from "./dto/receive-purchase-order.dto";
import { UpdatePurchaseOrderDto } from "./dto/update-purchase-order.dto";
import { PurchaseOrdersService } from "./purchase-orders.service";

@Controller("purchase-orders")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  list(@Query("status") status?: string) {
    return this.purchaseOrdersService.list(status);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.purchaseOrdersService.get(id);
  }

  @Post()
  create(@Body() body: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(body);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(id, body);
  }

  @Post(":id/receive")
  receive(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.receive(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.purchaseOrdersService.remove(id);
  }
}
