import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    return this.prisma.supplier.findMany({
      where: {
        active: true,
        ...(search
          ? { name: { contains: search, mode: "insensitive" } }
          : {}),
      },
      orderBy: { name: "asc" },
    });
  }

  async get(id: number) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, active: true },
    });
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }
    return supplier;
  }

  create(data: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: data.name.trim(),
        taxId: data.taxId?.trim(),
        email: data.email?.trim(),
        phone: data.phone?.trim(),
        notes: data.notes?.trim(),
      },
    });
  }

  async update(id: number, data: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, active: true },
    });
    if (!existing) {
      throw new NotFoundException("Supplier not found");
    }
    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: data.name?.trim() ?? existing.name,
        taxId: data.taxId?.trim(),
        email: data.email?.trim(),
        phone: data.phone?.trim(),
        notes: data.notes?.trim(),
      },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.supplier.findFirst({
      where: { id, active: true },
    });
    if (!existing) {
      throw new NotFoundException("Supplier not found");
    }
    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }
}
