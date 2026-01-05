import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
const AdmZip = require("adm-zip");
import { ExportImportService } from "./export-import.service";
import { ImportQueryDto } from "./dto/import-query.dto";

@Controller()
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ExportImportController {
  constructor(private readonly exportImportService: ExportImportService) {}

  @Get("export")
  async exportAll(@Res() res: Response) {
    const data = await this.exportImportService.buildExport();
    const zip = new AdmZip();

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(data.manifest)));
    zip.addFile("products.json", Buffer.from(JSON.stringify(data.products)));
    zip.addFile("locations.json", Buffer.from(JSON.stringify(data.locations)));
    zip.addFile(
      "stock_moves.json",
      Buffer.from(JSON.stringify(data.stock_moves)),
    );
    zip.addFile(
      "stock_move_lines.json",
      Buffer.from(JSON.stringify(data.stock_move_lines)),
    );
    zip.addFile("web_orders.json", Buffer.from(JSON.stringify(data.web_orders)));
    zip.addFile(
      "web_order_lines.json",
      Buffer.from(JSON.stringify(data.web_order_lines)),
    );
    zip.addFile("settings.json", Buffer.from(JSON.stringify(data.settings)));

    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=export.zip");
    res.send(buffer);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  async importAll(
    @Query() query: ImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Missing file");
    }

    const zip = new AdmZip(file.buffer);
    const manifest = this.readJson(zip, "manifest.json");
    const products = this.readJson(zip, "products.json");
    const locations = this.readJson(zip, "locations.json");
    const stock_moves = this.readJson(zip, "stock_moves.json");
    const stock_move_lines = this.readJson(zip, "stock_move_lines.json");
    const web_orders = this.readJson(zip, "web_orders.json");
    const web_order_lines = this.readJson(zip, "web_order_lines.json");
    const settings = this.readJson(zip, "settings.json");

    return this.exportImportService.importData(
      {
        manifest,
        products,
        locations,
        stock_moves,
        stock_move_lines,
        web_orders,
        web_order_lines,
        settings,
      },
      query.mode,
    );
  }

  private readJson(zip: any, name: string) {
    const entry = zip.getEntry(name);
    if (!entry) {
      throw new BadRequestException(`Missing ${name} in zip`);
    }
    const raw = entry.getData().toString("utf-8");
    return JSON.parse(raw);
  }
}
