import { IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class UpdateStatusDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  phaseId?: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}
