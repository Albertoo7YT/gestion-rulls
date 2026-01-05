import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";
import { PaymentMethodsService } from "./payment-methods.service";

@Controller("payment-methods")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get()
  list() {
    return this.paymentMethodsService.list();
  }

  @Post()
  create(@Body() body: CreatePaymentMethodDto) {
    return this.paymentMethodsService.create(body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.paymentMethodsService.remove(id);
  }
}
