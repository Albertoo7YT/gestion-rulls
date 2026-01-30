import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAccessoryDto } from "./dto/create-accessory.dto";
import { UpdateAccessoryDto } from "./dto/update-accessory.dto";

@Injectable()
export class AccessoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(active?: boolean) {
    return this.prisma.accessory.findMany({
      where: typeof active === "boolean" ? { active } : undefined,
      orderBy: { name: "asc" },
    });
  }

  create(data: CreateAccessoryDto) {
    return this.prisma.accessory.create({
      data: {
        name: data.name,
        cost: data.cost,
        price: data.price,
        active: data.active ?? true,
      },
    });
  }

  async update(id: number, data: UpdateAccessoryDto) {
    const existing = await this.prisma.accessory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Accessory not found");
    }
    return this.prisma.accessory.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        cost: data.cost ?? existing.cost,
        price: data.price ?? existing.price,
        active: data.active ?? existing.active,
      },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.accessory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Accessory not found");
    }
    return this.prisma.accessory.update({
      where: { id },
      data: { active: false },
    });
  }
}
