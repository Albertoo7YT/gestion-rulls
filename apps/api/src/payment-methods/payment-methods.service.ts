import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePaymentMethodDto } from "./dto/create-payment-method.dto";

@Injectable()
export class PaymentMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  }

  async create(data: CreatePaymentMethodDto) {
    const name = data.name.trim();
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { name },
    });
    if (existing) {
      if (existing.active) {
        throw new BadRequestException("Metodo de pago ya existe");
      }
      return this.prisma.paymentMethod.update({
        where: { id: existing.id },
        data: { active: true },
      });
    }
    return this.prisma.paymentMethod.create({
      data: { name },
    });
  }

  async remove(id: number) {
    const existing = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Payment method not found");
    }
    return this.prisma.paymentMethod.update({
      where: { id },
      data: { active: false },
    });
  }
}
