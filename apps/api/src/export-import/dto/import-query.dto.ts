import { IsIn } from "class-validator";

export class ImportQueryDto {
  @IsIn(["restore", "merge"])
  mode: "restore" | "merge";
}
