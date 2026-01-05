import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";

@Controller("suppliers")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@Query("search") search?: string) {
    return this.suppliersService.list(search);
  }

  @Get(":id")
  get(@Param("id", ParseIntPipe) id: number) {
    return this.suppliersService.get(id);
  }

  @Post()
  create(@Body() body: CreateSupplierDto) {
    return this.suppliersService.create(body);
  }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() body: UpdateSupplierDto) {
    return this.suppliersService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.suppliersService.remove(id);
  }
}
