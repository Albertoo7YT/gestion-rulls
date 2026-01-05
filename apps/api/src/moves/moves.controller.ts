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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AdjustMoveDto } from "./dto/adjust-move.dto";
import { B2bSaleMoveDto } from "./dto/b2b-sale-move.dto";
import { PurchaseMoveDto } from "./dto/purchase-move.dto";
import { TransferMoveDto } from "./dto/transfer-move.dto";
import { UpdateMoveDto } from "./dto/update-move.dto";
import { MovesService } from "./moves.service";

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
  list(@Query("types") types?: string) {
    return this.movesService.list(types);
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
  createPurchase(@Body() body: PurchaseMoveDto) {
    return this.movesService.createPurchase(body);
  }

  @Post("transfer")
  createTransfer(@Body() body: TransferMoveDto) {
    return this.movesService.createTransfer(body);
  }

  @Post("b2b-sale")
  createB2bSale(@Body() body: B2bSaleMoveDto) {
    return this.movesService.createB2bSale(body);
  }

  @Post("adjust")
  createAdjust(@Body() body: AdjustMoveDto) {
    return this.movesService.createAdjust(body);
  }
}
