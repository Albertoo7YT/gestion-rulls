import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(data: CreateCustomerDto) {
    return this.prisma.customer.create({ data });
  }

  async update(id: number, data: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing || !existing.active) {
      throw new NotFoundException("Customer not found");
    }
    return this.prisma.customer.update({ where: { id }, data });
  }

  async remove(id: number) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Customer not found");
    }
    return this.prisma.customer.update({
      where: { id },
      data: { active: false },
    });
  }
}
