import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/roles.decorator";
import {
  CreateDocumentSeriesDto,
  UpdateDocumentSeriesDto,
} from "./document-series.dto";
import { DocumentSeriesService } from "./document-series.service";

@Controller("document-series")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class DocumentSeriesController {
  constructor(private readonly service: DocumentSeriesService) {}

  @Get()
  @Roles(UserRole.admin)
  list() {
    return this.service.list();
  }

  @Post()
  @Roles(UserRole.admin)
  create(@Body() dto: CreateDocumentSeriesDto) {
    return this.service.create(dto);
  }

  @Put(":code")
  @Roles(UserRole.admin)
  update(@Param("code") code: string, @Body() dto: UpdateDocumentSeriesDto) {
    return this.service.update(code, dto);
  }

  @Delete(":code")
  @Roles(UserRole.admin)
  remove(@Param("code") code: string) {
    return this.service.remove(code);
  }
}
