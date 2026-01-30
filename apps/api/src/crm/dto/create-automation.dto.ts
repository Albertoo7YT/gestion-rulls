import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";

const CRM_TRIGGERS = ["on_status_changed", "on_task_completed", "daily_scheduler"] as const;

export class CreateAutomationDto {
  @IsString()
  name!: string;

  @IsIn(CRM_TRIGGERS as unknown as string[])
  trigger!: (typeof CRM_TRIGGERS)[number];

  @IsObject()
  conditions!: Record<string, unknown>;

  @IsObject()
  actions!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
