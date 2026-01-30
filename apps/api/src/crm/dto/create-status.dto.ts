import { IsInt, IsObject, IsOptional, IsString, Min } from "class-validator";

export class CreateStatusDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsInt()
  @Min(1)
  phaseId!: number;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsObject()
  rules?: Record<string, unknown>;
}
