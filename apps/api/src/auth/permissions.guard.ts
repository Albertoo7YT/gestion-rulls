import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { UserRole } from "@prisma/client";

const rolePermissions: Record<string, string[]> = {
  admin: ["*"],
  commercial: ["crm.view", "crm.manage", "crm.tasks.manage"],
  store: ["crm.view"],
  warehouse: ["crm.view"],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: UserRole } | undefined;
    const role = user?.role ?? "admin";
    const allowed = rolePermissions[role] ?? [];
    if (allowed.includes("*")) return true;
    return required.every((perm) => allowed.includes(perm));
  }
}
