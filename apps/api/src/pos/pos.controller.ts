import {
  Body,
  Controller,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { PosReturnDto } from "./dto/pos-return.dto";
import { PosSaleDto } from "./dto/pos-sale.dto";
import { PosService } from "./pos.service";

@Controller("pos")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post("sale")
  createSale(@Body() body: PosSaleDto, @Req() req: Request & { user?: any }) {
    return this.posService.createSale(body, req.user?.id);
  }

  @Post("return")
  createReturn(@Body() body: PosReturnDto, @Req() req: Request & { user?: any }) {
    return this.posService.createReturn(body, req.user?.id);
  }
}
