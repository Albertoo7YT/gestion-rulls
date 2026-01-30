import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type SeriesAllocation = {
  reference: string;
  seriesCode: string;
  seriesYear: number | null;
  seriesNumber: number;
};

@Injectable()
export class SeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async allocate(
    tx: Prisma.TransactionClient,
    scope: string,
    date: Date,
  ): Promise<SeriesAllocation> {
    const year = date.getFullYear();
    const preferredMap: Record<string, string> = {
      sale_b2c: "B2C",
      sale_b2b: "B2B",
      return: "DEV",
      deposit: "DEP",
      web: "WEB",
    };
    const preferredCode = preferredMap[scope];
    let series = preferredCode
      ? await tx.documentSeries.findFirst({
          where: {
            scope,
            active: true,
            code: preferredCode,
            OR: [{ year: null }, { year }],
          },
          orderBy: [{ year: "desc" }, { id: "asc" }],
        })
      : null;

    if (!series) {
      series = await tx.documentSeries.findFirst({
        where: {
          scope,
          active: true,
          OR: [{ year: null }, { year }],
        },
        orderBy: [{ year: "desc" }, { id: "asc" }],
      });
    }

    if (!series && preferredCode) {
      series = await tx.documentSeries.create({
        data: {
          code: preferredCode,
          name: `Serie ${preferredCode}`,
          scope,
          prefix: preferredCode,
          year,
          nextNumber: 1,
          padding: 6,
          active: true,
        },
      });
    }

    if (!series) {
      throw new BadRequestException(`No series configured for ${scope}`);
    }

    const currentNumber = series.nextNumber;
    await tx.documentSeries.update({
      where: { id: series.id },
      data: { nextNumber: { increment: 1 } },
    });

    const seriesYear = series.year ?? null;
    const pad = String(currentNumber).padStart(series.padding ?? 6, "0");
    const prefix = series.prefix ?? series.code;
    const reference = seriesYear ? `${prefix}-${seriesYear}-${pad}` : `${prefix}-${pad}`;

    return {
      reference,
      seriesCode: series.code,
      seriesYear,
      seriesNumber: currentNumber,
    };
  }
}
