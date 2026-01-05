import { LocationType } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class ListLocationsQueryDto {
  @IsOptional()
  @IsEnum(LocationType)
  type?: LocationType;
}
