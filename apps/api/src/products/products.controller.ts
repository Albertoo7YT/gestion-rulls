import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateQuickProductDto } from "./dto/create-quick-product.dto";
import { ConvertToStandardDto } from "./dto/convert-to-standard.dto";
import { ListProductsQueryDto } from "./dto/list-products-query.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@Controller("products")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.list(query);
  }

  @Post()
  createStandard(@Body() body: CreateProductDto, @Req() req: Request & { user?: any }) {
    return this.productsService.createStandard(body, req.user?.id);
  }

  @Post("quick")
  createQuick(@Body() body: CreateQuickProductDto, @Req() req: Request & { user?: any }) {
    return this.productsService.createQuick(body, req.user?.id);
  }

  @Get(":sku/moves")
  listMoves(@Param("sku") sku: string) {
    return this.productsService.listMoves(sku);
  }

  @Get(":sku")
  getBySku(@Param("sku") sku: string) {
    return this.productsService.getBySku(sku);
  }

  @Put(":sku")
  update(
    @Param("sku") sku: string,
    @Body() body: UpdateProductDto,
    @Req() req: Request & { user?: any },
  ) {
    return this.productsService.update(sku, body, req.user?.id);
  }

  @Delete(":sku")
  remove(@Param("sku") sku: string, @Query("hard") hard?: string) {
    return this.productsService.remove(sku, hard === "true");
  }

  @Post(":sku/convert-to-standard")
  convertToStandard(
    @Param("sku") sku: string,
    @Body() body: ConvertToStandardDto,
    @Req() req: Request & { user?: any },
  ) {
    return this.productsService.convertToStandard(sku, body, req.user?.id);
  }
}
