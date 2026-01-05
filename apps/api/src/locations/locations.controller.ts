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
import { CreateLocationDto } from "./dto/create-location.dto";
import { ListLocationsQueryDto } from "./dto/list-locations-query.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

@Controller("locations")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  list(@Query() query: ListLocationsQueryDto) {
    return this.locationsService.list(query);
  }

  @Post()
  create(@Body() body: CreateLocationDto) {
    return this.locationsService.create(body);
  }

  @Get(":id")
  getById(@Param("id", ParseIntPipe) id: number) {
    return this.locationsService.getById(id);
  }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() body: UpdateLocationDto) {
    return this.locationsService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.locationsService.softDelete(id);
  }
}
