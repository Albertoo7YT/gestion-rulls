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

  @Get("summary")
  summary(@Query() query: ReportsQueryDto) {
    return this.reportsService.summary(query);
  }

  @Get("deposits")
  deposits(@Query() query: ReportsQueryDto) {
    return this.reportsService.depositsSummary(query);
  }

  @Get("cash-closures")
  cashClosures(@Query() query: ReportsQueryDto) {
    return this.reportsService.listClosures(query);
  }

  @Get("moves/:id/ticket")
  async moveTicket(@Param("id", ParseIntPipe) id: number, @Res() res: Response) {
    const data = await this.reportsService.getMoveReportData(id);
    const pdf = await this.reportsService.renderMoveReportPdf(data, "ticket");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ticket-${data.number}.pdf"`,
    );
    res.send(pdf);
  }

  @Get("moves/:id/invoice")
  async moveInvoice(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getMoveReportData(id);
    const pdf = await this.reportsService.renderMoveReportPdf(data, "invoice");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${data.number}.pdf"`,
    );
    res.send(pdf);
  }

  @Get("moves/:id/delivery")
  async moveDelivery(
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getMoveReportData(id);
    const pdf = await this.reportsService.renderMoveReportPdf(data, "delivery");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="albaran-${data.number}.pdf"`,
    );
    res.send(pdf);
  }
}
