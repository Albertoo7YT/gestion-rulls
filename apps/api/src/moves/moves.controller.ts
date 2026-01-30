import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  ParseIntPipe,
  Req,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { Request } from "express";
import { AdjustMoveDto } from "./dto/adjust-move.dto";
import { B2bSaleMoveDto } from "./dto/b2b-sale-move.dto";
import { PurchaseMoveDto } from "./dto/purchase-move.dto";
import { TransferMoveDto } from "./dto/transfer-move.dto";
import { UpdateMoveDto } from "./dto/update-move.dto";
import { MovesService } from "./moves.service";
import { MovesQueryDto } from "./dto/moves-query.dto";

@Controller("moves")
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class MovesController {
  constructor(private readonly movesService: MovesService) {}

  @Get()
  list(@Query() query: MovesQueryDto) {
    return this.movesService.list(query);
  }

  @Get(":id")
  getById(@Param("id", ParseIntPipe) id: number) {
    return this.movesService.getById(id);
  }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() body: UpdateMoveDto) {
    return this.movesService.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.movesService.remove(id);
  }

  @Post("purchase")
  createPurchase(@Body() body: PurchaseMoveDto, @Req() req: Request & { user?: any }) {
    return this.movesService.createPurchase(body, req.user?.id);
  }

  @Post("transfer")
  createTransfer(@Body() body: TransferMoveDto, @Req() req: Request & { user?: any }) {
    return this.movesService.createTransfer(body, req.user?.id);
  }

  @Post("b2b-sale")
  createB2bSale(@Body() body: B2bSaleMoveDto, @Req() req: Request & { user?: any }) {
    return this.movesService.createB2bSale(body, req.user?.id);
  }

  @Post("adjust")
  createAdjust(@Body() body: AdjustMoveDto, @Req() req: Request & { user?: any }) {
    return this.movesService.createAdjust(body, req.user?.id);
  }
}
