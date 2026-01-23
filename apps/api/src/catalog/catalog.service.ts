import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
const PDFDocument = require("pdfkit");

const LOGO_URL =
  "https://rulls.eu/wp-content/uploads/2025/12/Rulls-Eslogan-Blanco.png";

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateCatalogPdf(skus: string[] | undefined, res: any) {
    const list = Array.isArray(skus) ? skus.filter((s) => s.trim()) : [];
    if (list.length === 0) {
      throw new BadRequestException("SKUs required");
    }

    const products = await this.prisma.product.findMany({
      where: { sku: { in: list } },
      include: {
        categories: { include: { category: true } },
      },
    });

    const productMap = new Map(products.map((p) => [p.sku, p]));
    const ordered = list.map((sku) => productMap.get(sku)).filter(Boolean);
    if (ordered.length === 0) {
      throw new BadRequestException("No products found");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="catalogo.pdf"`,
    );

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 32, bottom: 32, left: 32, right: 32 },
    });
    doc.pipe(res);

    const accent = "#f77e21";
    const headerBg = "#3a2f29";
    const ink = "#2b2420";
    const muted = "#7b7068";
    const soft = "#f6f3ef";
    const cardStroke = "#e5dbd1";
    const shadow = "#e0d9d1";

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;
    const cols = 3;
    const gutter = 14;
    const cardWidth = (pageWidth - margin * 2 - gutter * (cols - 1)) / cols;
    const cardHeight = 230;
    const imageHeight = 110;
    const headerHeight = 86;
    const footerHeight = 22;

    const logo = await this.fetchImage(LOGO_URL);

    const drawHeader = () => {
      doc.rect(0, 0, pageWidth, headerHeight).fill(headerBg);
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(22)
        .text("CATALOGO DE PRODUCTOS", margin, 28, {
          width: pageWidth - margin * 2,
          align: "center",
        });
      if (logo) {
        doc.image(logo, margin, 24, { height: 28 });
      }
    };
    const drawFooter = () => {
      const text = `Pagina ${doc.page.pageNumber}`;
      doc
        .fillColor(muted)
        .font("Helvetica")
        .fontSize(9)
        .text(text, margin, doc.page.height - footerHeight, {
          width: pageWidth - margin * 2,
          align: "right",
        });
    };

    drawHeader();
    drawFooter();
    let x = margin;
    let y = headerHeight + 16;

    for (let i = 0; i < ordered.length; i += 1) {
      if (y + cardHeight > doc.page.height - margin - footerHeight) {
        doc.addPage();
        drawHeader();
        drawFooter();
        x = margin;
        y = headerHeight + 16;
      }

      const product = ordered[i];
      if (!product) continue;

      doc
        .roundedRect(x + 2, y + 3, cardWidth, cardHeight, 12)
        .fill(shadow);
      doc
        .roundedRect(x, y, cardWidth, cardHeight, 12)
        .fillAndStroke("#ffffff", cardStroke);

      const labelWidth = Math.min(cardWidth - 24, 110);
      doc
        .roundedRect(x + 12, y - 10, labelWidth, 20, 6)
        .fill(headerBg);
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(product.name.slice(0, 18), x + 18, y - 6, {
          width: labelWidth - 12,
          align: "center",
        });

      const imageX = x + 12;
      const imageY = y + 12;
      const imageW = cardWidth - 24;

      const image = await this.fetchImage(product.photoUrl ?? undefined);
      if (image) {
        doc.image(image, imageX, imageY, {
          fit: [imageW, imageHeight],
          align: "center",
          valign: "center",
        });
      } else {
        doc
          .rect(imageX, imageY, imageW, imageHeight)
          .fill(soft);
        doc
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(10)
          .text("Sin imagen", imageX, imageY + 50, {
            width: imageW,
            align: "center",
          });
      }

      const textX = x + 14;
      const baseY = y + 12 + imageHeight + 10;

      const rows = [
        { label: "Modelo", value: product.manufacturerRef ?? product.sku },
        { label: "Color", value: product.color ?? "-" },
        { label: "Categoria", value: product.categories[0]?.category.name ?? "-" },
      ];

      rows.forEach((row, idx) => {
        const rowY = baseY + idx * 18;
        doc
          .fillColor(muted)
          .font("Helvetica")
          .fontSize(9)
          .text(row.label, textX, rowY);
        doc
          .fillColor(ink)
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(row.value, textX + 64, rowY, {
            width: cardWidth - 86,
            ellipsis: true,
          });
      });

      doc
        .roundedRect(x + cardWidth - 76, y + cardHeight - 32, 60, 20, 8)
        .fill(accent);
      doc
        .fillColor("#1b120a")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(
          product.rrp ? `${product.rrp}€` : "-",
          x + cardWidth - 72,
          y + cardHeight - 28,
          { width: 52, align: "center" },
        );

      x += cardWidth + gutter;
      if (x + cardWidth > pageWidth - margin) {
        x = margin;
        y += cardHeight + gutter;
      }
    }

    doc.end();

    await this.auditService.log({
      method: "POST",
      path: "/catalog/pdf",
      action: "catalog_pdf",
      entity: "Catalog",
      requestBody: { skus: list },
      responseBody: { count: ordered.length },
      statusCode: 200,
    });
  }

  private async fetchImage(url?: string | null) {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }
}
