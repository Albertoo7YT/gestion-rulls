import { Module } from "@nestjs/common";
import { MovesController } from "./moves.controller";
import { MovesService } from "./moves.service";

@Module({
  controllers: [MovesController],
  providers: [MovesService],
})
export class MovesModule {}
