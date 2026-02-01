import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StockMoveChannel, StockMoveType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports-query.dto";
const PDFDocument = require("pdfkit");

type MoveReportLine = {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  addOnPrice: number;
  addOns: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  lineTotal: number;
};

type MoveReportData = {
  id: number;
  number: string;
  date: Date;
  typeLabel: string;
  paymentMethod: string;
  paymentStatus: "pending" | "partial" | "paid";
  paidAmount: number;
  amountPaid: number;
  amountDue: number;
  units: number;
  discountTotal: number;
  total: number;
  lines: MoveReportLine[];
  issuer?: {
    name?: string | null;
    taxId?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    province?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  customer?: {
    name: string;
    taxId?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    postalCode?: string | null;
    province?: string | null;
    city?: string | null;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
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
          customer: {
            select: {
              name: true,
              taxId: true,
              addressLine1: true,
              addressLine2: true,
              postalCode: true,
              province: true,
              city: true,
              country: true,
              email: true,
              phone: true,
            },
          },
        },
      });
      const issuer = await this.prisma.settings.findUnique({
        where: { id: 1 },
        select: {
          issuerName: true,
          issuerTaxId: true,
          issuerAddressLine1: true,
          issuerAddressLine2: true,
          issuerPostalCode: true,
          issuerCity: true,
          issuerProvince: true,
          issuerCountry: true,
          issuerEmail: true,
          issuerPhone: true,
        },
      });

    if (!move) {
      throw new NotFoundException(`Move ${id} not found`);
    }

    const isReturn =
      move.type === StockMoveType.b2b_return ||
      move.type === StockMoveType.b2c_return;
    const isGift = this.isGiftMove(move.notes);
    const isDeposit =
      move.type === StockMoveType.transfer &&
      (move.notes ?? "").toUpperCase().includes("DEPOSITO");
    const sign = isReturn ? -1 : 1;
    const isSale =
      move.type === StockMoveType.b2b_sale ||
      move.type === StockMoveType.b2c_sale ||
      isReturn;

    let discountTotal = 0;
    let total = 0;
    let units = 0;

    const lines = move.lines.map((line) => {
      const reportUnitPrice = isDeposit
        ? Number(line.product?.b2bPrice ?? 0)
        : line.unitPrice
        ? Number(line.unitPrice)
        : 0;
      const addOnPrice = line.addOnPrice ? Number(line.addOnPrice) : 0;
      const addOnsRaw = Array.isArray(line.addOns)
        ? (line.addOns as Array<Record<string, unknown>>)
        : [];
      const addOns = addOnsRaw.map((addOn) => {
        const quantity = Number((addOn as { quantity?: unknown }).quantity ?? 1);
        const price = Number((addOn as { price?: unknown }).price ?? 0);
        return {
          name: String((addOn as { name?: unknown }).name ?? "Accesorio"),
          quantity,
          price,
          total: price * quantity * sign,
        };
      });
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
        basePrice && basePrice > reportUnitPrice
          ? (basePrice - reportUnitPrice) * line.quantity
          : 0;
      discountTotal += lineDiscount * sign;
      const lineTotal = (reportUnitPrice * line.quantity + addOnPrice) * sign;
      total += lineTotal;
      units += line.quantity;
      return {
        sku: line.sku,
        name: line.product?.name ?? line.sku,
        quantity: line.quantity,
        unitPrice: reportUnitPrice,
        addOnPrice,
        addOns,
        lineTotal,
      };
    });

      const paidAmount = Number(move.paidAmount ?? 0);
      const amountPaid =
        move.paymentStatus === "paid"
          ? total
          : move.paymentStatus === "pending"
          ? 0
          : paidAmount;
      const amountDue = Math.max(0, Number((total - amountPaid).toFixed(2)));

      return {
        id: move.id,
        number: move.reference?.trim() || `MOVE-${move.id}`,
        date: move.date,
        typeLabel: isDeposit
          ? "Deposito"
          : this.getMoveTypeLabel(move.type, move.channel, isGift),
        paymentMethod: this.getPaymentMethod(move.notes),
        paymentStatus: move.paymentStatus ?? "pending",
        paidAmount,
        amountPaid,
        amountDue,
        units,
        discountTotal,
        total,
        lines,
        issuer: issuer
          ? {
              name: issuer.issuerName,
              taxId: issuer.issuerTaxId,
              addressLine1: issuer.issuerAddressLine1,
              addressLine2: issuer.issuerAddressLine2,
              postalCode: issuer.issuerPostalCode,
              city: issuer.issuerCity,
              province: issuer.issuerProvince,
              country: issuer.issuerCountry,
              email: issuer.issuerEmail,
              phone: issuer.issuerPhone,
            }
          : null,
        customer: move.customer ?? null,
      };
    }

    renderMoveReportHtml(data: MoveReportData, variant: "ticket" | "invoice") {
      const logoUrl =
        process.env.REPORT_LOGO_URL ||
        "https://rulls.eu/wp-content/uploads/2023/09/Logo-negro-png-pequeno.png";
      const width = "210mm";
      const title = variant === "ticket" ? "Ticket" : "Factura";
      const invoiceBase = data.total / 1.21;
      const invoiceVat = data.total - invoiceBase;
      const paymentLabel =
        data.paymentStatus === "paid"
          ? "Pagado"
          : data.paymentStatus === "partial"
          ? `Parcial (Pagado ${data.amountPaid.toFixed(2)} / Pendiente ${data.amountDue.toFixed(2)})`
          : "Pendiente";
      const issuer = data.issuer;
      const customer = data.customer;
      const issuerAddress = [
        issuer?.addressLine1,
        issuer?.addressLine2,
      ]
        .filter(Boolean)
        .join(" ");
      const issuerCity = [
        issuer?.postalCode,
        issuer?.city,
        issuer?.province,
      ]
        .filter(Boolean)
        .join(" ");
      const customerAddress = [
        customer?.addressLine1,
        customer?.addressLine2,
      ]
        .filter(Boolean)
        .join(" ");
      const customerCity = [
        customer?.postalCode,
        customer?.city,
        customer?.province,
      ]
        .filter(Boolean)
        .join(" ");

    const rows = data.lines
      .map(
        (line) => `
          <tr>
            <td class="col-sku">${line.sku}</td>
            <td class="col-name">${line.name}</td>
            <td class="num col-qty">${line.quantity}</td>
            <td class="num col-price">${line.unitPrice.toFixed(2)}</td>
            <td class="num col-total">${line.lineTotal.toFixed(2)}</td>
          </tr>
        `,
      )
      .join("");

    const accessoryItems = data.lines
      .flatMap((line) => line.addOns ?? [])
      .reduce((acc, item) => {
        const key = `${item.name}|${item.price}`;
        const current = acc.get(key) ?? {
          name: item.name,
          quantity: 0,
          price: item.price,
          total: 0,
        };
        current.quantity += item.quantity;
        current.total += item.total;
        acc.set(key, current);
        return acc;
      }, new Map<string, { name: string; quantity: number; price: number; total: number }>());
    const accessoriesRows = Array.from(accessoryItems.values())
      .map(
        (item) => `
          <tr>
            <td class="col-name">${item.name}</td>
            <td class="num col-qty">${item.quantity}</td>
            <td class="num col-price">${item.price.toFixed(2)}</td>
            <td class="num col-total">${item.total.toFixed(2)}</td>
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
      :root {
        --ink: #1f1f1f;
        --muted: #6b6b6b;
        --line: #e6e6e6;
        --accent: #f77e21;
        --bg: #ffffff;
        --soft: #f8f8f8;
      }
      * { box-sizing: border-box; }
      body { font-family: "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 18px; color: var(--ink); background: var(--bg); }
      .sheet { width: ${width}; max-width: 100%; margin: 0 auto; }
      .hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border-radius: 12px; background: linear-gradient(135deg, #fff 0%, #fdf6ef 100%); border: 1px solid #f2e7dc; }
      .hero-title { font-size: 22px; margin: 0; letter-spacing: .4px; }
      .hero-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
      .logo { width: 170px; height: auto; max-height: 64px; object-fit: contain; display: block; }
      .logo.ticket { width: 120px; max-height: 36px; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 16px; margin-top: 12px; font-size: 12px; color: var(--muted); }
      .meta-item strong { color: var(--ink); font-weight: 600; }
      .pill { display: inline-block; padding: 4px 8px; border-radius: 999px; background: var(--accent); color: #fff; font-size: 11px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; table-layout: fixed; }
      th, td { padding: 8px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      th { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); }
      tbody tr:nth-child(even) { background: var(--soft); }
      .num { text-align: right; white-space: nowrap; }
      .col-sku { width: 14%; }
      .col-name { width: 50%; word-break: break-word; padding-right: 14px; }
      .col-qty { width: 8%; }
      .col-price { width: 14%; }
      .col-total { width: 14%; }
      .section-title { margin: 16px 0 8px; font-weight: 700; color: var(--ink); }
      .summary { margin-top: 18px; padding: 12px; border-radius: 10px; background: #fff7f0; border: 1px solid #f4dcc7; font-size: 13px; }
      .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
      .summary-row strong { font-size: 15px; }
      .muted { color: var(--muted); }
      .footer-note { margin-top: 10px; font-size: 11px; color: var(--muted); text-align: center; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="hero">
        <div>
          <h1 class="hero-title">${title}</h1>
          <div class="hero-sub">Documento ${data.number}</div>
        </div>
        <img class="logo ${variant === "ticket" ? "ticket" : ""}" src="${logoUrl}" alt="Logo" />
      </div>
      ${
        data.typeLabel === "Deposito"
          ? `<div class="section-title" style="font-size:16px; text-align:center; color:#f77e21; margin-top:12px;">DEPOSITO</div>`
          : ""
      }
        <div class="meta-grid">
          <div class="meta-item">Metodo de pago: <strong>${data.paymentMethod}</strong></div>
          <div class="meta-item">Estado pago: <strong>${paymentLabel}</strong></div>
          <div class="meta-item">Fecha: <strong>${new Date(data.date).toLocaleString()}</strong></div>
          <div class="meta-item">Unidades: <strong>${data.units}</strong></div>
          <div class="meta-item">Numero: <strong>${data.number}</strong></div>
        </div>
        ${
          variant === "invoice"
            ? `
        <div class="section-title">Emisor</div>
        <div class="meta-grid">
          <div class="meta-item">Nombre: <strong>${issuer?.name ?? "-"}</strong></div>
          <div class="meta-item">NIF: <strong>${issuer?.taxId ?? "-"}</strong></div>
          <div class="meta-item">Direccion: <strong>${issuerAddress || "-"}</strong></div>
          <div class="meta-item">Ciudad: <strong>${issuerCity || "-"}</strong></div>
          <div class="meta-item">Pais: <strong>${issuer?.country ?? "-"}</strong></div>
          <div class="meta-item">Email: <strong>${issuer?.email ?? "-"}</strong></div>
          <div class="meta-item">Telefono: <strong>${issuer?.phone ?? "-"}</strong></div>
        </div>
        <div class="section-title">Destinatario</div>
        <div class="meta-grid">
          <div class="meta-item">Nombre: <strong>${customer?.name ?? "-"}</strong></div>
          <div class="meta-item">NIF: <strong>${customer?.taxId ?? "-"}</strong></div>
          <div class="meta-item">Direccion: <strong>${customerAddress || "-"}</strong></div>
          <div class="meta-item">Ciudad: <strong>${customerCity || "-"}</strong></div>
          <div class="meta-item">Pais: <strong>${customer?.country ?? "-"}</strong></div>
          <div class="meta-item">Email: <strong>${customer?.email ?? "-"}</strong></div>
          <div class="meta-item">Telefono: <strong>${customer?.phone ?? "-"}</strong></div>
        </div>
        `
            : ""
        }

      <table>
        <thead>
          <tr>
            <th class="col-sku">SKU</th>
            <th class="col-name">Producto</th>
            <th class="num col-qty">Ud.</th>
            <th class="num col-price">Precio</th>
            <th class="num col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${
        accessoriesRows
          ? `
      <div class="section-title">Accesorios</div>
      <table>
        <thead>
          <tr>
            <th class="col-name">Accesorio</th>
            <th class="num col-qty">Ud.</th>
            <th class="num col-price">Precio</th>
            <th class="num col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${accessoriesRows}
        </tbody>
      </table>
      `
          : ""
      }

      <div class="summary">
        <div class="summary-row"><span class="muted">Descuento</span><strong>${data.discountTotal.toFixed(2)}</strong></div>
        ${
          variant === "invoice"
            ? `
        <div class="summary-row"><span class="muted">Base imponible</span><strong>${invoiceBase.toFixed(2)}</strong></div>
        <div class="summary-row"><span class="muted">IVA 21%</span><strong>${invoiceVat.toFixed(2)}</strong></div>
        `
            : ""
        }
        <div class="summary-row"><span>Total</span><strong>${data.total.toFixed(2)}</strong></div>
      </div>
      <div class="footer-note">Gracias por su compra.</div>
    </div>
  </body>
</html>
`;
  }

  async renderMoveReportPdf(
    data: MoveReportData,
    variant: "ticket" | "invoice" | "delivery",
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      (async () => {
        const isTicket = variant === "ticket";
        const doc = new PDFDocument({
          size: "A4",
          margins: { top: 36, bottom: 36, left: 36, right: 36 },
        });

        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err: Error) => reject(err));

        const logoBuffer = await this.loadReportLogo();

      const title = isTicket ? "Ticket" : variant === "delivery" ? "Albaran" : "Factura";
      const paymentLabel =
        data.paymentStatus === "paid"
          ? "Pagado"
          : data.paymentStatus === "partial"
          ? `Parcial (Pagado ${data.amountPaid.toFixed(2)} / Pendiente ${data.amountDue.toFixed(2)})`
          : "Pendiente";
      const accent = "#f77e21";
      const accentSoft = "#fff4ea";
      const textDark = "#1f1d1b";
      const textMuted = "#6d6a67";
      const lineColor = "#f0d9c8";
      const zebra = "#faf7f3";
      const hasLogo = Boolean(logoBuffer);
      const contentX = doc.page.margins.left;
      const contentWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const headerY = doc.y;
      const headerHeight = isTicket ? 56 : 86;
      doc.roundedRect(contentX, headerY, contentWidth, headerHeight, 10);
      doc.fillAndStroke(accentSoft, lineColor);

      const headerPad = 14;
      const logoWidth = isTicket ? 120 : 140;
      const logoHeight = isTicket ? 28 : 28;
      if (logoBuffer) {
        doc.image(
          logoBuffer,
          contentX + contentWidth - logoWidth - headerPad,
          headerY + 10,
          { fit: [logoWidth, logoHeight] },
        );
      }
      const titleWidth = hasLogo
        ? contentWidth - headerPad * 3 - logoWidth
        : contentWidth - headerPad * 2;
      doc
        .fillColor(textDark)
        .fontSize(isTicket ? 14 : 20)
        .text(title, contentX + headerPad, headerY + 10, {
          width: titleWidth,
        });
      if (!isTicket) {
        doc
          .fontSize(10)
          .fillColor(textMuted)
          .text(
            `Documento: ${data.number}`,
            contentX + headerPad,
            headerY + 34,
          );
        doc.text(
          `Metodo de pago: ${data.paymentMethod}`,
          contentX + headerPad,
          headerY + 48,
        );
        doc.text(
          `Estado pago: ${paymentLabel}`,
          contentX + headerPad,
          headerY + 62,
        );
      }

      if (data.typeLabel === "Deposito") {
        doc
          .fillColor(accent)
          .fontSize(18)
          .text("DEPOSITO", contentX, headerY + headerHeight + 6, {
            width: contentWidth,
            align: "center",
          });
      }

      if (isTicket) {
        const metaY = headerY + headerHeight + 8;
        doc
          .fillColor(textMuted)
          .fontSize(7)
          .text(`Documento: ${data.number}`, contentX + headerPad, metaY)
          .text(
            `Fecha: ${new Date(data.date).toLocaleString()}`,
            contentX + headerPad,
            metaY + 12,
          )
          .text(
            `Metodo de pago: ${data.paymentMethod}`,
            contentX + headerPad,
            metaY + 24,
          )
          .text(
            `Estado pago: ${paymentLabel}`,
            contentX + headerPad,
            metaY + 36,
          );
        doc.text(
          `Unidades: ${data.units}`,
          contentX + headerPad,
          metaY + 48,
        );
      } else {
        doc
          .fillColor(textMuted)
          .fontSize(10)
          .text(
            `Fecha: ${new Date(data.date).toLocaleString()}`,
            contentX + headerPad,
            headerY + headerHeight - 20,
          );
        doc.text(
          `Estado pago: ${paymentLabel}`,
          contentX + headerPad + 230,
          headerY + headerHeight - 20,
        );
        doc.text(
          `Unidades: ${data.units}`,
          contentX + headerPad + 420,
          headerY + headerHeight - 20,
        );
      }

      const issuer = data.issuer;
      const customer = data.customer;
      if (!isTicket && variant === "invoice") {
        const leftX = contentX + headerPad;
        const colWidth = (contentWidth - headerPad * 3) / 2;
        const rightX = leftX + colWidth + headerPad;
        let infoY = headerY + headerHeight + 6;
        doc
          .fillColor(textDark)
          .fontSize(11)
          .text("Emisor", leftX, infoY, { width: colWidth });
        doc.text("Destinatario", rightX, infoY, { width: colWidth });
        infoY += 14;
        const issuerLines = [
          issuer?.name ?? "-",
          issuer?.taxId ? `NIF: ${issuer.taxId}` : "NIF: -",
          issuer?.addressLine1 ?? "-",
          issuer?.addressLine2 ?? "",
          [issuer?.postalCode, issuer?.city, issuer?.province]
            .filter(Boolean)
            .join(" "),
          issuer?.country ?? "",
          issuer?.email ?? "",
          issuer?.phone ?? "",
        ].filter((line) => line.trim().length > 0);
        const customerLines = [
          customer?.name ?? "-",
          customer?.taxId ? `NIF: ${customer.taxId}` : "NIF: -",
          customer?.addressLine1 ?? "-",
          customer?.addressLine2 ?? "",
          [customer?.postalCode, customer?.city, customer?.province]
            .filter(Boolean)
            .join(" "),
          customer?.country ?? "",
          customer?.email ?? "",
          customer?.phone ?? "",
        ].filter((line) => line.trim().length > 0);
        doc.fillColor(textMuted).fontSize(9);
        issuerLines.forEach((line, index) => {
          doc.text(line, leftX, infoY + index * 12, {
            width: colWidth,
          });
        });
        customerLines.forEach((line, index) => {
          doc.text(line, rightX, infoY + index * 12, {
            width: colWidth,
          });
        });
        const rows = Math.max(issuerLines.length, customerLines.length);
        doc.y = infoY + rows * 12 + 8;
      } else {
        doc.y = isTicket ? headerY + headerHeight + 58 : headerY + headerHeight + 14;
      }

      const rowHeight = 20;
      const colSkuWidth = Math.round(contentWidth * 0.16);
      const colQtyWidth = Math.round(contentWidth * 0.10);
      const colPriceWidth = Math.round(contentWidth * 0.16);
      const colTotalWidth = Math.round(contentWidth * 0.16);
      const colNameWidth =
        contentWidth - (colSkuWidth + colQtyWidth + colPriceWidth + colTotalWidth) - 4;
      const colSku = contentX;
      const colName = colSku + colSkuWidth;
      const colQty = colName + colNameWidth;
      const colPrice = colQty + colQtyWidth;
      const colTotal = colPrice + colPriceWidth;
      const headerRowY = doc.y;

      doc.rect(contentX, headerRowY, contentWidth, rowHeight).fill("#f2ebe4");
      doc.fillColor(textMuted).fontSize(isTicket ? 8 : 10);
      doc.text("SKU", colSku + 2, headerRowY + 4);
      doc.text("Producto", colName, headerRowY + 4);
      doc.text("Ud.", colQty, headerRowY + 4, {
        width: colPrice - colQty - 2,
        align: "right",
      });
      doc.text("Precio", colPrice, headerRowY + 4, {
        width: colTotal - colPrice - 2,
        align: "right",
      });
      doc.text("Total", colTotal, headerRowY + 4, {
        width: contentX + contentWidth - colTotal,
        align: "right",
      });

      let cursorY = headerRowY + rowHeight;
      const nameWidth = colQty - colName - 6;
      data.lines.forEach((line, index) => {
        if (index % 2 === 1) {
          doc.rect(contentX, cursorY, contentWidth, rowHeight).fill(zebra);
        }
        const name =
          isTicket && line.name.length > 26
            ? `${line.name.slice(0, 26)}...`
            : line.name;
        doc
          .fillColor(textDark)
          .fontSize(isTicket ? 8 : 10)
          .text(line.sku, colSku + 2, cursorY + 4, {
            width: colName - colSku - 6,
            ellipsis: true,
          })
          .text(name, colName, cursorY + 4, {
            width: nameWidth,
            ellipsis: true,
          })
          .text(String(line.quantity), colQty, cursorY + 4, {
            width: colPrice - colQty - 2,
            align: "right",
          });
        doc.text(line.unitPrice.toFixed(2), colPrice, cursorY + 4, {
          width: colTotal - colPrice - 2,
          align: "right",
        });
        doc.text(line.lineTotal.toFixed(2), colTotal, cursorY + 4, {
          width: contentX + contentWidth - colTotal,
          align: "right",
        });
        cursorY += rowHeight;
      });

      const accessoryItems = data.lines
        .flatMap((line) => line.addOns ?? [])
        .reduce((acc, item) => {
          const key = `${item.name}|${item.price}`;
          const current = acc.get(key) ?? {
            name: item.name,
            quantity: 0,
            price: item.price,
            total: 0,
          };
          current.quantity += item.quantity;
          current.total += item.total;
          acc.set(key, current);
          return acc;
        }, new Map<string, { name: string; quantity: number; price: number; total: number }>());

      if (accessoryItems.size) {
        cursorY += 10;
        doc
          .fillColor(textDark)
          .fontSize(isTicket ? 9 : 11)
          .text("Accesorios", contentX, cursorY);
        cursorY += rowHeight;
        doc.rect(contentX, cursorY, contentWidth, rowHeight).fill("#f2ebe4");
        doc
          .fillColor(textMuted)
          .fontSize(isTicket ? 8 : 10)
          .text("Accesorio", colSku + 2, cursorY + 4)
          .text("Ud.", colQty, cursorY + 4, {
            width: colPrice - colQty - 2,
            align: "right",
          });
        doc.text("Precio", colPrice, cursorY + 4, {
          width: colTotal - colPrice - 2,
          align: "right",
        });
        doc.text("Total", colTotal, cursorY + 4, {
          width: contentX + contentWidth - colTotal,
          align: "right",
        });
        cursorY += rowHeight;

        Array.from(accessoryItems.values()).forEach((item, index) => {
          if (index % 2 === 1) {
            doc.rect(contentX, cursorY, contentWidth, rowHeight).fill(zebra);
          }
          doc
            .fillColor(textDark)
            .fontSize(isTicket ? 8 : 10)
            .text(item.name, colSku + 2, cursorY + 4, {
              width: colName - colSku - 6,
              ellipsis: true,
            })
            .text(String(item.quantity), colQty, cursorY + 4, {
              width: colPrice - colQty - 2,
              align: "right",
            });
          doc.text(item.price.toFixed(2), colPrice, cursorY + 4, {
            width: colTotal - colPrice - 2,
            align: "right",
          });
          doc.text(item.total.toFixed(2), colTotal, cursorY + 4, {
            width: contentX + contentWidth - colTotal,
            align: "right",
          });
          cursorY += rowHeight;
        });
      }

      const summaryWidth = isTicket ? contentWidth : 220;
      const summaryX = isTicket
        ? contentX
        : contentX + contentWidth - summaryWidth;
      const summaryY = cursorY + 14;
      const isInvoice = variant === "invoice";
      const summaryHeight = isTicket ? 54 : isInvoice ? 104 : 70;
      doc.roundedRect(summaryX, summaryY, summaryWidth, summaryHeight, 10);
      doc.fillAndStroke("#fff7ef", lineColor);
      doc
        .fillColor(textMuted)
        .fontSize(isTicket ? 8 : 10)
        .text("Descuento", summaryX + 12, summaryY + 12);
      doc
        .fillColor(textDark)
        .fontSize(isTicket ? 10 : 12)
        .text(data.discountTotal.toFixed(2), summaryX + 12, summaryY + 10, {
          width: summaryWidth - 24,
          align: "right",
        });
      const baseImponible = data.total / 1.21;
      const iva = data.total - baseImponible;

      if (isInvoice && !isTicket) {
        doc
          .fillColor(textMuted)
          .fontSize(10)
          .text("Base imponible", summaryX + 12, summaryY + 32);
        doc
          .fillColor(textDark)
          .fontSize(12)
          .text(baseImponible.toFixed(2), summaryX + 12, summaryY + 30, {
            width: summaryWidth - 24,
            align: "right",
          });
        doc
          .fillColor(textMuted)
          .fontSize(10)
          .text("IVA 21%", summaryX + 12, summaryY + 52);
        doc
          .fillColor(textDark)
          .fontSize(12)
          .text(iva.toFixed(2), summaryX + 12, summaryY + 50, {
            width: summaryWidth - 24,
            align: "right",
          });
        doc
          .fillColor(textMuted)
          .fontSize(11)
          .text("Total", summaryX + 12, summaryY + 72);
        doc
          .fillColor(textDark)
          .fontSize(16)
          .text(data.total.toFixed(2), summaryX + 12, summaryY + 68, {
            width: summaryWidth - 24,
            align: "right",
          });
      } else {
        doc
          .fillColor(textMuted)
          .fontSize(isTicket ? 9 : 11)
          .text("Total", summaryX + 12, summaryY + 32);
        doc
          .fillColor(textDark)
          .fontSize(isTicket ? 12 : 16)
          .text(data.total.toFixed(2), summaryX + 12, summaryY + 28, {
            width: summaryWidth - 24,
            align: "right",
          });
      }

      doc
        .fillColor(textMuted)
        .fontSize(isTicket ? 7 : 9)
        .text(
          "Gracias por su compra.",
          contentX,
          summaryY + summaryHeight + 12,
          { align: "left" },
        );

        doc.end();
      })().catch(reject);
    });
  }

  private async loadReportLogo(): Promise<Buffer | null> {
    const logoUrl =
      process.env.REPORT_LOGO_URL ||
      "https://rulls.eu/wp-content/uploads/2023/09/Logo-negro-png-pequeno.png";
    try {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      return Buffer.from(buffer);
    } catch {
      return null;
    }
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
            WHEN m."notes" ILIKE '%REGALO%' THEN 0
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
            WHEN m."notes" ILIKE '%REGALO%' THEN 0
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
            WHEN m."notes" ILIKE '%REGALO%' THEN 0
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

  async summary(query: ReportsQueryDto) {
    const where = this.buildWhere(query);
    const returnTypes = Prisma.join([
      Prisma.sql`${StockMoveType.b2b_return}::"StockMoveType"`,
      Prisma.sql`${StockMoveType.b2c_return}::"StockMoveType"`,
    ]);
    const rows = await this.prisma.$queryRaw<
      {
        units: number;
        revenue: number;
        cost: number;
        orders: number;
        revenuePaid: number;
      }[]
    >(Prisma.sql`
      WITH move_totals AS (
        SELECT
          m."id" as "id",
          m."payment_status" as "paymentStatus",
          COALESCE(m."paid_amount", 0) as "paidAmount",
          SUM(
            CASE
              WHEN m."type" IN (${returnTypes}) THEN -l."quantity"
              ELSE l."quantity"
            END
          ) as "units",
          SUM(
            CASE
              WHEN m."notes" ILIKE '%REGALO%' THEN 0
              WHEN m."type" IN (${returnTypes})
                THEN -(COALESCE(l."unitPrice", 0) * l."quantity" + COALESCE(l."addOnPrice", 0))
              ELSE (COALESCE(l."unitPrice", 0) * l."quantity" + COALESCE(l."addOnPrice", 0))
            END
          ) as "revenue",
          SUM(
            CASE
              WHEN m."type" IN (${returnTypes})
                THEN -((COALESCE(p."cost", 0) * l."quantity") + COALESCE(l."addOnCost", 0))
              ELSE ((COALESCE(p."cost", 0) * l."quantity") + COALESCE(l."addOnCost", 0))
            END
          ) as "cost"
        FROM "StockMove" m
        JOIN "StockMoveLine" l ON l."moveId" = m."id"
        LEFT JOIN "Product" p ON p."sku" = l."sku"
        ${where}
        GROUP BY m."id", m."payment_status", m."paid_amount"
      )
      SELECT
        CAST(COALESCE(SUM("units"), 0) AS INTEGER) as "units",
        CAST(COALESCE(SUM("revenue"), 0) AS DOUBLE PRECISION) as "revenue",
        CAST(COALESCE(SUM("cost"), 0) AS DOUBLE PRECISION) as "cost",
        CAST(COUNT(*) AS INTEGER) as "orders",
        CAST(COALESCE(SUM(
          CASE
            WHEN "paymentStatus" = 'paid' THEN "revenue"
            WHEN "paymentStatus" = 'partial' THEN
              CASE
                WHEN "revenue" >= 0 THEN LEAST("paidAmount", "revenue")
                ELSE -LEAST("paidAmount", ABS("revenue"))
              END
            ELSE 0
          END
        ), 0) AS DOUBLE PRECISION) as "revenuePaid"
      FROM move_totals;
    `);
    const row = rows[0] || {
      units: 0,
      revenue: 0,
      cost: 0,
      orders: 0,
      revenuePaid: 0,
    };

    const returnRows = await this.prisma.$queryRaw<
      { units: number; revenue: number; cost: number }[]
    >(Prisma.sql`
      SELECT
        CAST(SUM(l."quantity") AS INTEGER) as "units",
        CAST(SUM(
          CASE
            WHEN m."notes" ILIKE '%REGALO%' THEN 0
            ELSE (COALESCE(l."unitPrice", 0) * l."quantity" + COALESCE(l."addOnPrice", 0))
          END
        ) AS DOUBLE PRECISION) as "revenue",
        CAST(SUM((COALESCE(p."cost", 0) * l."quantity") + COALESCE(l."addOnCost", 0)) AS DOUBLE PRECISION) as "cost"
      FROM "StockMove" m
      JOIN "StockMoveLine" l ON l."moveId" = m."id"
      LEFT JOIN "Product" p ON p."sku" = l."sku"
      ${where}
      AND m."type" IN (${returnTypes});
    `);
    const returnRow = returnRows[0] || { units: 0, revenue: 0, cost: 0 };
    const revenue = row.revenue ?? 0;
    const revenuePaid = row.revenuePaid ?? 0;
    let revenuePending = revenue - revenuePaid;

    if (query.channel === "WEB") {
      const webWhere: Prisma.WebOrderWhereInput = {};
      const cutoff = new Date("2026-01-01T00:00:00.000Z");
      let createdAtWoo: Prisma.DateTimeFilter = {};
      if (query.from) {
        const from = new Date(query.from);
        if (!Number.isNaN(from.getTime())) {
          createdAtWoo.gte = from;
        }
      }
      if (query.to) {
        const to = new Date(query.to);
        if (!Number.isNaN(to.getTime())) {
          createdAtWoo.lte = to;
        }
      }
      if (!createdAtWoo.gte || createdAtWoo.gte < cutoff) {
        createdAtWoo.gte = cutoff;
      }
      webWhere.createdAtWoo = createdAtWoo;

      const webOrders = await this.prisma.webOrder.findMany({
        where: webWhere,
        include: { lines: true },
      });

      if (webOrders.length) {
        const referenceCandidates = webOrders.flatMap((order) =>
          this.getWebReferenceCandidates(order),
        );
        const moves = await this.prisma.stockMove.findMany({
          where: { reference: { in: referenceCandidates } },
          select: { reference: true },
        });
        const moveRefs = new Set(
          moves.map((move) => move.reference ?? ""),
        );
        revenuePending = webOrders
          .filter((order) => {
            const refs = this.getWebReferenceCandidates(order);
            const hasMove = refs.some((ref) => moveRefs.has(ref));
            return !order.processedAt || !hasMove;
          })
          .reduce((sum, order) => {
            const linesTotal = order.lines.reduce((lineSum, line) => {
              const base =
                Number(line.lineTotal ?? 0) ||
                Number(line.qty ?? 0) * Number(line.price ?? 0);
              return lineSum + base;
            }, 0);
            return sum + linesTotal;
          }, 0);
      } else {
        revenuePending = 0;
      }
    }
    return {
      units: row.units ?? 0,
      revenue,
      revenuePaid,
      revenuePending,
      cost: row.cost ?? 0,
      margin: revenue - (row.cost ?? 0),
      orders: row.orders ?? 0,
      returnsUnits: returnRow.units ?? 0,
      returnsRevenue: returnRow.revenue ?? 0,
      returnsCost: returnRow.cost ?? 0,
    };
  }

  async depositsSummary(query: ReportsQueryDto) {
    const dateFilter: Prisma.StockMoveWhereInput["date"] = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        dateFilter.gte = from;
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        dateFilter.lte = to;
      }
    }

    const baseDateFilter = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const depositInLines = await this.prisma.stockMoveLine.findMany({
      where: {
        move: {
          type: StockMoveType.transfer,
          notes: { startsWith: "DEPOSITO" },
          ...baseDateFilter,
          NOT: [
            { notes: { contains: "CONVERTIDO" } },
            { notes: { contains: "DEVUELTO" } },
          ],
        },
      },
      select: { sku: true, quantity: true },
    });

    const convertedLines = await this.prisma.stockMoveLine.findMany({
      where: {
        move: {
          type: StockMoveType.b2b_sale,
          notes: { contains: "DEPOSITO CONVERTIDO" },
          ...baseDateFilter,
        },
      },
      select: { sku: true, quantity: true, unitPrice: true },
    });

    const returnedLines = await this.prisma.stockMoveLine.findMany({
      where: {
        move: {
          type: StockMoveType.transfer,
          notes: { contains: "DEPOSITO DEVUELTO" },
          ...baseDateFilter,
        },
      },
      select: { sku: true, quantity: true },
    });

    const allSkus = Array.from(
      new Set([
        ...depositInLines.map((l) => l.sku),
        ...convertedLines.map((l) => l.sku),
        ...returnedLines.map((l) => l.sku),
      ]),
    );
    const products = allSkus.length
      ? await this.prisma.product.findMany({
          where: { sku: { in: allSkus } },
          select: { sku: true, cost: true },
        })
      : [];
    const costMap = new Map(products.map((p) => [p.sku, Number(p.cost ?? 0)]));

    const sumBySku = (lines: { sku: string; quantity: number }[]) => {
      const map = new Map<string, number>();
      for (const line of lines) {
        map.set(line.sku, (map.get(line.sku) ?? 0) + line.quantity);
      }
      return map;
    };

    const inMap = sumBySku(depositInLines);
    const convertedMap = sumBySku(convertedLines);
    const returnedMap = sumBySku(returnedLines);

    let pendingUnits = 0;
    let pendingCost = 0;
    for (const sku of allSkus) {
      const pending =
        (inMap.get(sku) ?? 0) -
        (convertedMap.get(sku) ?? 0) -
        (returnedMap.get(sku) ?? 0);
      if (pending <= 0) continue;
      pendingUnits += pending;
      pendingCost += pending * (costMap.get(sku) ?? 0);
    }

    const convertedUnits = convertedLines.reduce((sum, line) => sum + line.quantity, 0);
    const convertedRevenue = convertedLines.reduce(
      (sum, line) => sum + (Number(line.unitPrice ?? 0) * line.quantity),
      0,
    );
    const returnedUnits = returnedLines.reduce((sum, line) => sum + line.quantity, 0);

    return {
      pendingUnits,
      pendingCost,
      convertedUnits,
      convertedRevenue,
      returnedUnits,
    };
  }

  async createDailyClosure(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const existing = await this.prisma.cashClosure.findUnique({
      where: { date: start },
    });
    if (existing) {
      return existing;
    }

    const moves = await this.prisma.stockMove.findMany({
      where: {
        date: { gte: start, lte: end },
        type: {
          in: [
            StockMoveType.b2b_sale,
            StockMoveType.b2c_sale,
            StockMoveType.b2b_return,
            StockMoveType.b2c_return,
          ],
        },
      },
      include: { lines: true },
    });

    const skus = Array.from(
      new Set(moves.flatMap((move) => move.lines.map((line) => line.sku))),
    );
    const products = skus.length
      ? await this.prisma.product.findMany({
          where: { sku: { in: skus } },
          select: { sku: true, cost: true },
        })
      : [];
    const costMap = new Map(products.map((p) => [p.sku, Number(p.cost ?? 0)]));

    const breakdown: Record<
      string,
      { revenue: number; cost: number; margin: number; orders: number; units: number }
    > = {};

    let revenue = 0;
    let cost = 0;
    let orders = 0;
    let units = 0;

      for (const move of moves) {
        const isReturn =
          move.type === StockMoveType.b2b_return ||
          move.type === StockMoveType.b2c_return;
        const sign = isReturn ? -1 : 1;
        const isGift = this.isGiftMove(move.notes);
        const method = this.getPaymentMethod(move.notes) || "Desconocido";
        if (!breakdown[method]) {
          breakdown[method] = { revenue: 0, cost: 0, margin: 0, orders: 0, units: 0 };
        }
      breakdown[method].orders += 1;
      orders += 1;

        for (const line of move.lines) {
        const lineRevenue = isGift
          ? 0
          : (Number(line.unitPrice ?? 0) * line.quantity +
              Number(line.addOnPrice ?? 0)) *
            sign;
        const lineCost =
          (costMap.get(line.sku) ?? 0) * line.quantity +
          Number(line.addOnCost ?? 0);

        revenue += lineRevenue;
        cost += lineCost * sign;
        units += line.quantity * sign;

        breakdown[method].revenue += lineRevenue;
        breakdown[method].cost += lineCost * sign;
        breakdown[method].units += line.quantity * sign;
      }
    }

    Object.keys(breakdown).forEach((key) => {
      breakdown[key].margin = breakdown[key].revenue - breakdown[key].cost;
    });

    return this.prisma.cashClosure.create({
      data: {
        date: start,
        from: start,
        to: end,
        revenue,
        cost,
        margin: revenue - cost,
        breakdown,
      },
    });
  }

  async listClosures(query: ReportsQueryDto) {
    const where: Prisma.CashClosureWhereInput = {};
    let dateFilter: Prisma.DateTimeFilter | undefined;
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        dateFilter = { ...(dateFilter ?? {}), gte: from };
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        dateFilter = { ...(dateFilter ?? {}), lte: to };
      }
    }
    if (dateFilter) {
      where.date = dateFilter;
    }
    return this.prisma.cashClosure.findMany({
      where,
      orderBy: { date: "desc" },
    });
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
      if (query.channel === "WEB") {
        conditions.push(
          Prisma.sql`(
            m."series_code" ILIKE 'WEB%'
            OR m."reference" ILIKE 'WEB-%'
            OR m."reference" IN (SELECT w."number" FROM "WebOrder" w)
          )`,
        );
      } else {
        conditions.push(
          Prisma.sql`${query.channel}::"StockMoveChannel" = m."channel"`,
        );
      }
    }

    if (query.seriesCode) {
      conditions.push(
        Prisma.sql`LOWER(m."series_code") = LOWER(${query.seriesCode})`,
      );
    }

    if (query.seriesScope) {
      conditions.push(
        Prisma.sql`m."series_code" IN (SELECT s."code" FROM "DocumentSeries" s WHERE s."scope" = ${query.seriesScope})`,
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

  private getWebReferenceCandidates(order: {
    createdAtWoo: Date;
    number: string;
  }) {
    const year = order.createdAtWoo.getFullYear();
    const raw = String(order.number);
    const parsed = Number(raw.replace(/\D/g, ""));
    const padded =
      Number.isFinite(parsed) && parsed > 0 ? String(parsed).padStart(6, "0") : null;
    const refs = [`WEB-${year}-${raw}`];
    if (padded && padded !== raw) {
      refs.push(`WEB-${year}-${padded}`);
    }
    return refs;
  }
}
