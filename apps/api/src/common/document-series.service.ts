import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateDocumentSeriesDto,
  UpdateDocumentSeriesDto,
} from "./document-series.dto";

@Injectable()
export class DocumentSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.documentSeries.findMany({
      orderBy: [{ scope: "asc" }, { year: "desc" }, { code: "asc" }],
    });
  }

  async create(dto: CreateDocumentSeriesDto) {
    return this.prisma.documentSeries.create({
      data: {
        code: dto.code,
        name: dto.name,
        scope: dto.scope,
        prefix: dto.prefix,
        year: dto.year ?? null,
        nextNumber: dto.nextNumber ?? 1,
        padding: dto.padding ?? 6,
        active: dto.active ?? true,
      },
    });
  }

  async update(code: string, dto: UpdateDocumentSeriesDto) {
    const existing = await this.prisma.documentSeries.findUnique({
      where: { code },
      select: { code: true },
    });
    if (!existing) {
      throw new NotFoundException(`Series ${code} not found`);
    }
    return this.prisma.documentSeries.update({
      where: { code },
      data: {
        name: dto.name,
        scope: dto.scope,
        prefix: dto.prefix,
        year: dto.year === null ? null : dto.year,
        nextNumber: dto.nextNumber,
        padding: dto.padding,
        active: dto.active,
      },
    });
  }

  async remove(code: string) {
    const existing = await this.prisma.documentSeries.findUnique({
      where: { code },
      select: { code: true },
    });
    if (!existing) {
      throw new NotFoundException(`Series ${code} not found`);
    }
    return this.prisma.documentSeries.delete({ where: { code } });
  }
}
