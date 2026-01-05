import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports-query.dto";

type MoveReportLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type MoveReportData = {
  id: number;
  number: string;
  date: Date;
  typeLabel: string;
  paymentMethod: string;
  units: number;
  discountTotal: number;
  total: number;
  lines: MoveReportLine[];
};

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMoveReportData(id: number): Promise<MoveReportData> {
    const move = await this.prisma.stockMove.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: { select: { name: true, rrp: true, b2bPrice: true } },
          },
        },
      },
    });

    if (!move) {
      throw new NotFoundException(`Move ${id} not found`);
    }

    const isReturn =
      move.type === StockMoveType.b2b_return ||
      move.type === StockMoveType.b2c_return;
    const isGift = this.isGiftMove(move.notes);
    const sign = isReturn ? -1 : 1;
    const isSale =
      move.type === StockMoveType.b2b_sale ||
      move.type === StockMoveType.b2c_sale ||
      isReturn;

    let discountTotal = 0;
    let total = 0;
    let units = 0;

    const lines = move.lines.map((line) => {
      const unitPrice = line.unitPrice ? Number(line.unitPrice) : 0;
      const basePrice = isSale
        ? move.channel === StockMoveChannel.B2B
          ? line.product?.b2bPrice
            ? Number(line.product.b2bPrice)
            : null
          : line.product?.rrp
          ? Number(line.product.rrp)
          : null
        : null;
      const lineDiscount =
        basePrice && basePrice > unitPrice
          ? (basePrice - unitPrice) * line.quantity
          : 0;
      discountTotal += lineDiscount * sign;
      const lineTotal = unitPrice * line.quantity * sign;
      total += lineTotal;
      units += line.quantity;
      return {
        sku: line.sku,
        name: line.product?.name ?? line.sku,
        quantity: line.quantity,
        unitPrice,
        lineTotal,
      };
    });

    return {
      id: move.id,
      number: move.reference?.trim() || `MOVE-${move.id}`,
      date: move.date,
      typeLabel: this.getMoveTypeLabel(move.type, move.channel, isGift),
      paymentMethod: this.getPaymentMethod(move.notes),
      units,
      discountTotal,
      total,
      lines,
    };
  }

  renderMoveReportHtml(data: MoveReportData, variant: "ticket" | "invoice") {
    const logoUrl =
      process.env.REPORT_LOGO_URL ||
      "https://rulls.eu/wp-content/uploads/2023/09/Logo-negro-png-pequeno.png";
    const width = variant === "ticket" ? "80mm" : "210mm";
    const title = variant === "ticket" ? "Ticket" : "Factura";

    const rows = data.lines
      .map(
        (line) => `
          <tr>
            <td>${line.sku}</td>
            <td>${line.name}</td>
            <td class="num">${line.quantity}</td>
            <td class="num">${line.unitPrice.toFixed(2)}</td>
            <td class="num">${line.lineTotal.toFixed(2)}</td>
          </tr>
        `,
      )
      .join("");

    return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${title} ${data.number}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #222; }
      .sheet { width: ${width}; max-width: 100%; margin: 0 auto; }
      .header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .logo { max-height: 48px; }
      h1 { font-size: 18px; margin: 0 0 6px; }
      .meta { font-size: 12px; line-height: 1.5; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
      th, td { padding: 6px 4px; border-bottom: 1px solid #ddd; text-align: left; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #555; }
      .num { text-align: right; }
      .summary { margin-top: 16px; font-size: 13px; }
      .summary-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
      .muted { color: #666; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <h1>${title}</h1>
          <div class="meta">Numero: ${data.number}</div>
          <div class="meta">Tipo: ${data.typeLabel}</div>
          <div class="meta">Metodo de pago: ${data.paymentMethod}</div>
          <div class="meta">Fecha: ${new Date(data.date).toLocaleString()}</div>
          <div class="meta">Unidades: ${data.units}</div>
        </div>
        <img class="logo" src="${logoUrl}" alt="Logo" />
      </div>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Producto</th>
            <th class="num">Unidades</th>
            <th class="num">Precio</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span class="muted">Descuento</span><strong>${data.discountTotal.toFixed(2)}</strong></div>
        <div class="summary-row"><span>Total</span><strong>${data.total.toFixed(2)}</strong></div>
      </div>
    </div>
  </body>
</html>
`;
  }

  async salesByCategory(query: ReportsQueryDto) {
    const where = this.buildWhere(query);
    const returnTypes = Prisma.join([
      Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`,
      Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`,
    ]);
    return this.prisma.$queryRaw<
      {
        categoryId: number;
        categoryName: string;
        quantity: number;
        total: number;
      }[]
    >(Prisma.sql`
      SELECT
        c."id" as "categoryId",
        c."name" as "categoryName",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes}) THEN -l."quantity"
            ELSE l."quantity"
          END
        ) AS INTEGER) as "quantity",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes})
              THEN -l."quantity" * COALESCE(l."unitPrice", 0)
            ELSE l."quantity" * COALESCE(l."unitPrice", 0)
          END
        ) AS DOUBLE PRECISION) as "total"
      FROM "StockMove" m
      JOIN "StockMoveLine" l ON l."moveId" = m."id"
      JOIN "ProductCategory" pc ON pc."productSku" = l."sku"
      JOIN "Category" c ON c."id" = pc."categoryId"
      ${where}
      GROUP BY c."id", c."name"
      ORDER BY "total" DESC NULLS LAST;
    `);
  }

  async salesBySku(query: ReportsQueryDto) {
    const where = this.buildWhere(query);
    const returnTypes = Prisma.join([
      Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`,
      Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`,
    ]);
    return this.prisma.$queryRaw<
      { sku: string; name: string | null; quantity: number; total: number }[]
    >(Prisma.sql`
      SELECT
        l."sku" as "sku",
        p."name" as "name",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes}) THEN -l."quantity"
            ELSE l."quantity"
          END
        ) AS INTEGER) as "quantity",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes})
              THEN -l."quantity" * COALESCE(l."unitPrice", 0)
            ELSE l."quantity" * COALESCE(l."unitPrice", 0)
          END
        ) AS DOUBLE PRECISION) as "total"
      FROM "StockMove" m
      JOIN "StockMoveLine" l ON l."moveId" = m."id"
      LEFT JOIN "Product" p ON p."sku" = l."sku"
      ${where}
      GROUP BY l."sku", p."name"
      ORDER BY "total" DESC NULLS LAST;
    `);
  }

  async salesByMonth(query: ReportsQueryDto) {
    const where = this.buildWhere(query);
    const returnTypes = Prisma.join([
      Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`,
      Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`,
    ]);
    return this.prisma.$queryRaw<
      { month: string; quantity: number; total: number }[]
    >(Prisma.sql`
      SELECT
        to_char(date_trunc('month', m."date"), 'YYYY-MM') as "month",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes}) THEN -l."quantity"
            ELSE l."quantity"
          END
        ) AS INTEGER) as "quantity",
        CAST(SUM(
          CASE
            WHEN m."type" IN (${returnTypes})
              THEN -l."quantity" * COALESCE(l."unitPrice", 0)
            ELSE l."quantity" * COALESCE(l."unitPrice", 0)
          END
        ) AS DOUBLE PRECISION) as "total"
      FROM "StockMove" m
      JOIN "StockMoveLine" l ON l."moveId" = m."id"
      ${where}
      GROUP BY date_trunc('month', m."date")
      ORDER BY date_trunc('month', m."date") DESC;
    `);
  }

  private buildWhere(query: ReportsQueryDto) {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`m."type" IN (${Prisma.join([
        Prisma.sql`${StockMoveType.b2b_sale}::"StockMoveType"`,
        Prisma.sql`${StockMoveType.b2c_sale}::"StockMoveType"`,
        Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`,
        Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`,
      ])})`,
    ];

    if (query.channel) {
      conditions.push(
        Prisma.sql`${query.channel}::"StockMoveChannel" = m."channel"`,
      );
    }

    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        conditions.push(Prisma.sql`m."date" >= ${from}`);
      }
    }

    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        conditions.push(Prisma.sql`m."date" <= ${to}`);
      }
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  }

  private getPaymentMethod(notes?: string | null) {
    if (!notes) return "-";
    const [method] = notes.split("|").map((part) => part.trim());
    return method || "-";
  }

  private getMoveTypeLabel(
    type: StockMoveType,
    channel: StockMoveChannel,
    isGift: boolean,
  ) {
    switch (type) {
      case StockMoveType.b2b_sale:
        return isGift ? "Regalo B2B" : "Venta B2B";
      case StockMoveType.b2c_sale:
        return isGift ? "Regalo B2C" : "Venta B2C";
      case StockMoveType.b2b_return:
        return "Devolucion B2B";
      case StockMoveType.b2c_return:
        return "Devolucion B2C";
      case StockMoveType.transfer:
        return "Traspaso";
      case StockMoveType.purchase:
        return "Compra";
      case StockMoveType.adjust:
        return "Ajuste";
      default:
        return "Movimiento";
    }
  }

  private isGiftMove(notes?: string | null) {
    if (!notes) return false;
    return notes.toUpperCase().includes("REGALO");
  }
}
