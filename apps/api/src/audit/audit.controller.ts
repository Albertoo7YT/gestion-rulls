import { Controller, Get, Query } from "@nestjs/common";
import { AuditService } from "./audit.service";
import { Roles } from "../auth/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("audit")
@Roles(UserRole.admin)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : 100;
    return this.auditService.list(Number.isFinite(parsed) ? parsed : 100);
  }
}
