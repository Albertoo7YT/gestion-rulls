import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type AuditPayload = {
  userId?: number;
  method: string;
  path: string;
  action: string;
  entity?: string;
  entityId?: string;
  requestBody?: unknown;
  responseBody?: unknown;
  statusCode?: number;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    return this.prisma.auditLog.create({
      data: {
        userId: payload.userId ?? undefined,
        method: payload.method,
        path: payload.path,
        action: payload.action,
        entity: payload.entity ?? undefined,
        entityId: payload.entityId ?? undefined,
        requestBody: payload.requestBody as any ?? undefined,
        responseBody: payload.responseBody as any ?? undefined,
        statusCode: payload.statusCode ?? undefined,
      },
    });
  }

  list(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        user: { select: { id: true, email: true, username: true, role: true } },
      },
    });
  }
}
