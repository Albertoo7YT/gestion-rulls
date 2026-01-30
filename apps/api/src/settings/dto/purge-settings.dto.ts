import { ArrayNotEmpty, IsArray, IsString } from "class-validator";

export class PurgeSettingsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  targets!: string[];
}
