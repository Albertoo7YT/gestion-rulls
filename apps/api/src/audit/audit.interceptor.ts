import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { throwError } from "rxjs";
import { AuditService } from "./audit.service";

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const method: string = request.method;
    const path: string = request.originalUrl || request.url;
    const user = request.user as { id?: number } | undefined;
    const action =
      method === "POST"
        ? "create"
        : method === "PUT" || method === "PATCH"
        ? "update"
        : method === "DELETE"
        ? "delete"
        : "other";

    const entity = this.extractEntity(path);
    const requestBody = this.safeJson(request.body);

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle();
    }

    if (path.startsWith("/auth/login")) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((data) => {
        const entityId = this.extractEntityId(data);
        this.auditService
          .log({
            userId: user?.id,
            method,
            path,
            action,
            entity,
            entityId,
            requestBody,
            responseBody: this.safeJson(data),
            statusCode: response?.statusCode ?? 200,
          })
          .catch(() => null);
      }),
      catchError((err) => {
        const statusCode = err?.status ?? 500;
        this.auditService
          .log({
            userId: user?.id,
            method,
            path,
            action,
            entity,
            requestBody,
            responseBody: this.safeJson({
              message: err?.message,
              error: err?.name,
            }),
            statusCode,
          })
          .catch(() => null);
        return throwError(() => err);
      }),
    );
  }

  private extractEntity(path: string) {
    const clean = path.split("?")[0];
    const parts = clean.split("/").filter(Boolean);
    return parts[0] ?? null;
  }

  private extractEntityId(data: any) {
    if (!data) return undefined;
    if (typeof data === "string" || typeof data === "number") {
      return String(data);
    }
    return (
      data.id ??
      data.sku ??
      data.wooOrderId ??
      data.number ??
      data.name ??
      undefined
    )?.toString();
  }

  private safeJson(value: any) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return undefined;
    }
  }
}
