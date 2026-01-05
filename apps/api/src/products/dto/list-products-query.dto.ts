import { IsOptional, IsString } from "class-validator";

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
