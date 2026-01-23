import {
  Body,
  Controller,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Response } from "express";
import { CatalogService } from "./catalog.service";
import { CatalogPdfDto } from "./dto/catalog-pdf.dto";

@Controller("catalog")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post("pdf")
  async generatePdf(@Body() body: CatalogPdfDto, @Res() res: Response) {
    await this.catalogService.generateCatalogPdf(body.skus, res);
  }
}
