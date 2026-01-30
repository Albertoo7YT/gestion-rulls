import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateBoardDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  phaseId!: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  color?: string;
}
