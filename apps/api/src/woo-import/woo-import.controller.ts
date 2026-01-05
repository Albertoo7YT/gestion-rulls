import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { WooImportDto } from "./dto/woo-import.dto";
import { WooImportService } from "./woo-import.service";
import { WooExportStockDto } from "./dto/woo-export-stock.dto";

@Controller("woo")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class WooImportController {
  constructor(private readonly wooImportService: WooImportService) {}

  @Post("import")
  importFromWoo(@Body() body: WooImportDto) {
    return this.wooImportService.importFromWoo(body);
  }

  @Post("sync-products")
  syncProducts() {
    return this.wooImportService.syncProducts();
  }

  @Post("export-stock")
  exportStock(@Body() body: WooExportStockDto) {
    return this.wooImportService.exportStock(body);
  }

  @Post("test-connection")
  testConnection() {
    return this.wooImportService.testConnection();
  }
}
