import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateTaskDto {
  @IsString()
  type!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ownerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relatedCustomerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  relatedOpportunityId?: number;
}
