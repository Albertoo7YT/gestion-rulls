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

  list(query: ListCustomersQueryDto) {
    const search = query.search?.trim();
    return this.prisma.customer.findMany({
      where: {
        active: true,
        type: query.type,
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
  }

  async create(data: CreateCustomerDto, userId?: number) {
    const created = await this.prisma.customer.create({ data });
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
    const updated = await this.prisma.customer.update({ where: { id }, data });
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
}
