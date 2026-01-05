import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";
import { ListLocationsQueryDto } from "./dto/list-locations-query.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListLocationsQueryDto) {
    return this.prisma.location.findMany({
      where: {
        active: true,
        type: query.type,
      },
      orderBy: { id: "asc" },
    });
  }

  async getById(id: number) {
    const location = await this.prisma.location.findFirst({
      where: { id, active: true },
    });

    if (!location) {
      throw new NotFoundException("Location not found");
    }

    return location;
  }

  create(data: CreateLocationDto) {
    return this.prisma.location.create({ data });
  }

  async update(id: number, data: UpdateLocationDto) {
    await this.getById(id);
    return this.prisma.location.update({ where: { id }, data });
  }

  async softDelete(id: number) {
    await this.getById(id);
    return this.prisma.location.update({
      where: { id },
      data: { active: false },
    });
  }
}
