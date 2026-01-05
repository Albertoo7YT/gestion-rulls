import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Response } from "express";
import { ReportsQueryDto } from "./dto/reports-query.dto";
import { ReportsService } from "./reports.service";

@Controller("reports")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("sales-by-category")
  salesByCategory(@Query() query: ReportsQueryDto) {
    return this.reportsService.salesByCategory(query);
  }

  @Get("sales-by-sku")
  salesBySku(@Query() query: ReportsQueryDto) {
    return this.reportsService.salesBySku(query);
  }

  @Get("sales-by-month")
  salesByMonth(@Query() query: ReportsQueryDto) {
    return this.reportsService.salesByMonth(query);
  }

  @Get("moves/:id/ticket")
  async moveTicket(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const data = await this.reportsService.getMoveReportData(id);
    const html = this.reportsService.renderMoveReportHtml(data, "ticket");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }

  @Get("moves/:id/invoice")
  async moveInvoice(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getMoveReportData(id);
    const html = this.reportsService.renderMoveReportHtml(data, "invoice");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }
}
