import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateWooSettingsDto } from "./dto/update-woo-settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getSettings() {
    return this.prisma.settings.findUnique({ where: { id: 1 } });
  }

  async getWooSettings() {
    const settings = await this.prisma.settings.findUnique({
      where: { id: 1 },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });

    if (settings) {
      return settings;
    }

    return this.prisma.settings.create({
      data: {
        id: 1,
        wooSyncEnabled: true,
        wooStockWarehouseIds: [],
        lastWooSyncAt: null,
        wooBaseUrl: null,
        wooConsumerKey: null,
        wooConsumerSecret: null,
        wooSyncProducts: false,
        wooSyncImages: false,
      },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });
  }

  async updateWooSettings(data: UpdateWooSettingsDto) {
    if (data.wooStockWarehouseIds) {
      const uniqueIds = Array.from(new Set(data.wooStockWarehouseIds));
      if (uniqueIds.length > 0) {
        const count = await this.prisma.location.count({
          where: { id: { in: uniqueIds }, type: "warehouse", active: true },
        });
        if (count !== uniqueIds.length) {
          throw new BadRequestException(
            "All wooStockWarehouseIds must be warehouse locations",
          );
        }
      }
    }

    return this.prisma.settings.upsert({
      where: { id: 1 },
      update: {
        wooSyncEnabled: data.wooSyncEnabled,
        wooStockWarehouseIds: data.wooStockWarehouseIds,
        lastWooSyncAt: data.lastWooSyncAt
          ? new Date(data.lastWooSyncAt)
          : undefined,
        wooBaseUrl: data.wooBaseUrl,
        wooConsumerKey: data.wooConsumerKey,
        wooConsumerSecret: data.wooConsumerSecret,
        wooSyncProducts: data.wooSyncProducts,
        wooSyncImages: data.wooSyncImages,
      },
      create: {
        id: 1,
        wooSyncEnabled: data.wooSyncEnabled ?? true,
        wooStockWarehouseIds: data.wooStockWarehouseIds ?? [],
        lastWooSyncAt: data.lastWooSyncAt
          ? new Date(data.lastWooSyncAt)
          : null,
        wooBaseUrl: data.wooBaseUrl ?? null,
        wooConsumerKey: data.wooConsumerKey ?? null,
        wooConsumerSecret: data.wooConsumerSecret ?? null,
        wooSyncProducts: data.wooSyncProducts ?? false,
        wooSyncImages: data.wooSyncImages ?? false,
      },
      select: {
        wooSyncEnabled: true,
        wooStockWarehouseIds: true,
        lastWooSyncAt: true,
        wooBaseUrl: true,
        wooConsumerKey: true,
        wooConsumerSecret: true,
        wooSyncProducts: true,
        wooSyncImages: true,
      },
    });
  }
}
