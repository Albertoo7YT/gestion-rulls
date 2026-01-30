import { IsBoolean, IsObject, IsOptional, IsString } from "class-validator";

export class CreateSegmentDto {
  @IsString()
  name!: string;

  @IsObject()
  filters!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dynamic?: boolean;
}
