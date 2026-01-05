import { Controller, Get, Query, UsePipes, ValidationPipe } from "@nestjs/common";
import { StockQueryDto } from "./dto/stock-query.dto";
import { StockService } from "./stock.service";

@Controller("stock")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  getStock(@Query() query: StockQueryDto) {
    return this.stockService.getStock(query.locationId);
  }
}
