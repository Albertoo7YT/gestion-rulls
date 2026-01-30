import { Type } from "class-transformer";
import { IsInt, Min, ValidateNested } from "class-validator";
import { CreateTaskDto } from "./create-task.dto";

export class BulkCreateTasksDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  segmentId!: number;

  @ValidateNested()
  @Type(() => CreateTaskDto)
  task!: CreateTaskDto;
}
