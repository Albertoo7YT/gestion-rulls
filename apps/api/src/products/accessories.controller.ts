import {
  BadRequestException,
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
import { AccessoriesService } from "./accessories.service";
import { CreateAccessoryDto } from "./dto/create-accessory.dto";
import { UpdateAccessoryDto } from "./dto/update-accessory.dto";

@Controller("accessories")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class AccessoriesController {
  constructor(private readonly accessoriesService: AccessoriesService) {}

  @Get()
  list(@Query("active") active?: string) {
    if (active === undefined) {
      return this.accessoriesService.list(undefined);
    }
    if (active !== "true" && active !== "false" && active !== "1" && active !== "0") {
      throw new BadRequestException("Invalid active query");
    }
    const parsed = active === "true" || active === "1";
    return this.accessoriesService.list(parsed);
  }

  @Post()
  create(@Body() body: CreateAccessoryDto) {
    return this.accessoriesService.create(body);
  }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() body: UpdateAccessoryDto) {
    return this.accessoriesService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.accessoriesService.remove(id);
  }
}
