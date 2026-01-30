import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { DepositsService } from "./deposits.service";
import { CreateDepositReturnDto, CreateDepositSaleDto } from "./deposits.dto";

@Controller("deposits")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get("customers")
  listCustomers() {
    return this.depositsService.listCustomers();
  }

  @Get("customers/:id")
  getCustomer(@Param("id") id: string) {
    return this.depositsService.getCustomerDeposit(Number(id));
  }

  @Post("customers/:id/convert")
  convertToSale(
    @Param("id") id: string,
    @Body() body: CreateDepositSaleDto,
    @Req() req: Request & { user?: any },
  ) {
    return this.depositsService.convertToSale(Number(id), body, req.user?.id);
  }

  @Post("customers/:id/return")
  returnToWarehouse(
    @Param("id") id: string,
    @Body() body: CreateDepositReturnDto,
    @Req() req: Request & { user?: any },
  ) {
    return this.depositsService.returnToWarehouse(Number(id), body, req.user?.id);
  }
}
