import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
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
  createSale(@Body() body: PosSaleDto) {
    return this.posService.createSale(body);
  }

  @Post("return")
  createReturn(@Body() body: PosReturnDto) {
    return this.posService.createReturn(body);
  }
}
