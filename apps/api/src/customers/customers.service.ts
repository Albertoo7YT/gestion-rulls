import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ListCustomersQueryDto) {
    await this.normalizeLegacyTypes();
    const normalizedType = this.normalizeCustomerType(query.type);
    const search = query.search?.trim();
    const rows = await this.prisma.customer.findMany({
      where: {
        active: true,
        ...(normalizedType
          ? normalizedType === "public"
            ? { type: { in: ["public", "b2c"] } }
            : { type: normalizedType }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { taxId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      ...row,
      type: this.normalizeCustomerType(row.type) ?? row.type,
    }));
  }

  async create(data: CreateCustomerDto, userId?: number) {
    const created = await this.prisma.customer.create({
      data: {
        ...data,
        type: this.normalizeCustomerType(data.type) ?? data.type,
      },
    });
    await this.ensureRetailLocation(created);
    await this.auditService.log({
      userId,
      method: "POST",
      path: "/customers",
      action: "customer_change",
      entity: "customer",
      entityId: created.id.toString(),
      requestBody: { after: created },
      statusCode: 201,
    });
    return created;
  }

  async update(id: number, data: UpdateCustomerDto, userId?: number) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      throw new NotFoundException("Customer not found");
    }
    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        ...(data.type ? { type: this.normalizeCustomerType(data.type) } : {}),
      },
    });
    await this.ensureRetailLocation(updated, existing);
    await this.auditService.log({
      userId,
      method: "PUT",
      path: `/customers/${id}`,
      action: "customer_change",
      entity: "customer",
      entityId: id.toString(),
      requestBody: { before: existing, after: updated },
      statusCode: 200,
    });
    return updated;
  }

  async remove(id: number, userId?: number) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Customer not found");
    }
    const updated = await this.prisma.customer.update({
      where: { id },
      data: { active: false },
    });
    await this.auditService.log({
      userId,
      method: "DELETE",
      path: `/customers/${id}`,
      action: "customer_change",
      entity: "customer",
      entityId: id.toString(),
      requestBody: { before: existing, after: updated },
      statusCode: 200,
    });
    return updated;
  }

  private async ensureRetailLocation(
    customer: { id: number; name: string; type: string; city?: string | null; email?: string | null; phone?: string | null },
    previous?: { name: string; type: string },
  ) {
    if (customer.type.toLowerCase() !== "b2b") {
      return;
    }

    const existing = await this.prisma.location.findFirst({
      where: { type: "retail", name: { equals: previous?.name ?? customer.name, mode: "insensitive" } },
    });

    if (existing) {
      if (existing.name !== customer.name) {
        await this.prisma.location.update({
          where: { id: existing.id },
          data: { name: customer.name },
        });
      }
      return;
    }

    await this.prisma.location.create({
      data: {
        type: "retail",
        name: customer.name,
        city: customer.city ?? "",
        email: customer.email ?? undefined,
        phone: customer.phone ?? undefined,
        active: true,
      },
    });
  }

  private normalizeCustomerType(type?: string): "b2b" | "public" | undefined {
    if (!type) return undefined;
    const normalized = type.toLowerCase();
    if (normalized === "b2b") return "b2b";
    return "public";
  }

  private async normalizeLegacyTypes() {
    await this.prisma.customer.updateMany({
      where: { type: "b2c" },
      data: { type: "public" },
    });
  }
}
