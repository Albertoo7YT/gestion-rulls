"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { filterAndScoreSkus } from "../../lib/sku-search";

type Product = {
  sku: string;
  name: string;
  manufacturerRef?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  rrp: number | null;
  b2bPrice: number | null;
};

type Location = {
  id: number;
  name: string;
  type: "warehouse" | "retail";
  city?: string;
  active?: boolean;
};

type Customer = {
  id: number;
  name: string;
  type: "b2b" | "public" | "b2c";
  city?: string | null;
};
type PaymentMethod = { id: number; name: string };
type Accessory = { id: number; name: string; cost?: number | null; price?: number | null };
type LineAddOn = {
  accessoryId: number;
  name: string;
  price: number | null;
  quantity: number;
};

type PriceQuote = {
  sku: string;
  channel: "B2B" | "B2C";
  base: number | null;
  price: number | null;
  rule: { id: number; name: string; type: string; value: number } | null;
};

type MoveSummary = {
  id: number;
  type: string;
  date: string;
  reference?: string | null;
};

type MoveDetail = {
  id: number;
  type: string;
  channel: "B2B" | "B2C";
  date: string;
  fromId: number | null;
  reference?: string | null;
  lines: {
    sku: string;
    quantity: number;
    unitPrice: number | null;
    product?: { name: string | null };
  }[];
};

type Line = {
  sku: string;
  name: string;
  quantity: number | null;
  unitPrice?: number | null;
  discount?: number | null;
  addOns?: LineAddOn[];
};

type ReturnLine = {
  sku: string;
  name: string;
  soldQty: number;
  quantity: number | null;
  unitPrice: number | null;
};

export default function PosPage() {
  const [mode, setMode] = useState<"sale" | "transfer" | "return" | "waste">(
    "sale",
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
  const [retails, setRetails] = useState<Location[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [returnOrders, setReturnOrders] = useState<MoveSummary[]>([]);
  const [returnOrderId, setReturnOrderId] = useState<number | null>(null);
  const [returnLines, setReturnLines] = useState<ReturnLine[]>([]);
  const [returnWarehouseId, setReturnWarehouseId] = useState<number | null>(null);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSearchTerm, setReturnSearchTerm] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
  });
  const [saleDate, setSaleDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [returnDate, setReturnDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [wasteDate, setWasteDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [wasteReason, setWasteReason] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<
    "paid" | "pending" | "partial"
  >("paid");
  const [paidAmount, setPaidAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addToast, setAddToast] = useState<string | null>(null);
  const [giftSale, setGiftSale] = useState(false);
  const [b2bDeposit, setB2bDeposit] = useState(false);
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const [lastReportId, setLastReportId] = useState<number | null>(null);
  const [lastReportLabel, setLastReportLabel] = useState("");
  const [editingAddOnsSku, setEditingAddOnsSku] = useState<string | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const quoteCache = useRef<Map<string, number | null>>(new Map());

  async function loadCustomers(term?: string) {
    const query = term?.trim()
      ? `?search=${encodeURIComponent(term.trim())}`
      : "";
    const data = await api.get<Customer[]>(`/customers${query}`);
    setCustomers(data);
  }

  async function loadReturnOrders() {
    const data = await api.get<MoveSummary[]>("/moves?types=b2b_sale,b2c_sale");
    setReturnOrders(data);
  }

  async function loadAccessories() {
    const data = await api.get<Accessory[]>("/accessories?active=true");
    setAccessories(data);
  }

  async function selectReturnOrder(id: number) {
    setReturnLoading(true);
    try {
      const detail = await api.get<MoveDetail>(`/moves/${id}`);
      setReturnOrderId(detail.id);
      const fallbackWarehouseId =
        warehouses.find((w) => w.id === detail.fromId)?.id ??
        warehouses[0]?.id ??
        null;
      setReturnWarehouseId(fallbackWarehouseId);
      setReturnLines(
        detail.lines.map((line) => ({
          sku: line.sku,
          name: line.product?.name ?? line.sku,
          soldQty: line.quantity,
          quantity: 0,
          unitPrice:
            line.unitPrice === null || typeof line.unitPrice === "undefined"
              ? null
              : Number(line.unitPrice),
        })),
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setReturnLoading(false);
    }
  }

  useEffect(() => {
    setProductsLoading(true);
    Promise.all([
      api.get<Product[]>("/products"),
      api.get<Location[]>("/locations?type=warehouse"),
        api.get<Location[]>("/locations?type=retail"),
      api.get<PaymentMethod[]>("/payment-methods"),
      api.get<MoveSummary[]>("/moves?types=b2b_sale,b2c_sale"),
      api.get<Accessory[]>("/accessories?active=true"),
    ])
      .then(([p, w, r, pm, moves, acc]) => {
        setProducts(p);
        setWarehouses(w);
          setRetails(r);
        setPaymentMethods(pm);
        setReturnOrders(moves);
        setAccessories(acc);
        if (pm[0]) setPaymentMethod(pm[0].name);
        if (w[0]) {
          setFromId(w[0].id);
          setToId(w[0].id);
        }
      })
      .catch((err) => setStatus(err.message))
      .finally(() => setProductsLoading(false));
    loadCustomers().catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    loadCustomers(customerSearch).catch((err) => setStatus(err.message));
  }, [customerSearch]);

  const channel: "B2B" | "B2C" =
    selectedCustomer?.type === "b2b" ? "B2B" : "B2C";
  const customerTypeLabel = (type: Customer["type"]) =>
    type === "b2b" ? "B2B" : "Publico";

  useEffect(() => {
    if (channel !== "B2B") {
      setB2bDeposit(false);
    }
    if (giftSale) {
      setPaymentStatus("paid");
      setPaidAmount("0");
    } else {
      setPaymentStatus(channel === "B2B" ? "pending" : "paid");
      setPaidAmount("");
    }
  }, [channel, giftSale]);

  const parseNumberInput = (value: string) => {
    if (value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const extractErrorMessage = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(raw) as
        | { message?: string | string[] }
        | undefined;
      const message = parsed?.message;
      if (Array.isArray(message)) return message.join(" | ");
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // ignore JSON parse errors
    }
    return raw;
  };

  function toggleAddOn(sku: string, accessory: Accessory, checked: boolean) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.sku !== sku) return line;
        const current = line.addOns ?? [];
        if (checked) {
          if (current.find((a) => a.accessoryId === accessory.id)) {
            return line;
          }
          return {
            ...line,
            addOns: [
              ...current,
              { accessoryId: accessory.id, name: accessory.name, price: 0, quantity: 1 },
            ],
          };
        }
        return {
          ...line,
          addOns: current.filter((a) => a.accessoryId !== accessory.id),
        };
      }),
    );
  }

  function updateAddOnPrice(sku: string, accessoryId: number, price: number | null) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.sku !== sku) return line;
        return {
          ...line,
          addOns: (line.addOns ?? []).map((a) =>
            a.accessoryId === accessoryId ? { ...a, price } : a,
          ),
        };
      }),
    );
  }

  function updateAddOnQuantity(
    sku: string,
    accessoryId: number,
    quantity: number | null,
  ) {
    const safeQty = quantity && quantity > 0 ? Math.floor(quantity) : 1;
    setLines((prev) =>
      prev.map((line) => {
        if (line.sku !== sku) return line;
        return {
          ...line,
          addOns: (line.addOns ?? []).map((a) =>
            a.accessoryId === accessoryId ? { ...a, quantity: safeQty } : a,
          ),
        };
      }),
    );
  }

  useEffect(() => {
    if (!lines.length) return;
    refreshLinePrices(lines).catch((err) =>
      setStatus(err instanceof Error ? err.message : String(err)),
    );
  }, [channel]);

  const total = useMemo(() => {
    return lines.reduce((sum, line) => {
      const price = line.unitPrice ?? 0;
      const discount = line.discount ?? 0;
      const qty = line.quantity ?? 0;
      const effective = price * (1 - discount / 100);
      const addOnTotal = (line.addOns ?? []).reduce(
        (acc, addOn) => acc + (addOn.price ?? 0) * (addOn.quantity ?? 1),
        0,
      );
      const addOnEffective = qty > 0 ? addOnTotal : 0;
      return sum + effective * qty + addOnEffective;
    }, 0);
  }, [lines]);

  const returnTotal = useMemo(() => {
    return returnLines.reduce((sum, line) => {
      const price = line.unitPrice ?? 0;
      const qty = line.quantity ?? 0;
      return sum + price * qty;
    }, 0);
  }, [returnLines]);

  const filteredReturnOrders = useMemo(() => {
    const term = returnSearchTerm.trim().toLowerCase();
    if (!term) return returnOrders;
    return returnOrders.filter((order) => {
      const ref = (order.reference ?? `#${order.id}`).toLowerCase();
      const date = new Date(order.date).toLocaleDateString().toLowerCase();
      return (
        ref.includes(term) ||
        date.includes(term) ||
        String(order.id).includes(term)
      );
    });
  }, [returnOrders, returnSearchTerm]);

  const flatResults = useMemo(() => {
    if (!productSearch.trim()) return [];
    const scored = filterAndScoreSkus(products, productSearch);
    const scoreMap = new Map(scored.map(({ item, score }) => [item.sku, score]));
    const sorted = scored.map(({ item }) => item);
    sorted.sort((a, b) => {
      const scoreA = scoreMap.get(a.sku) ?? 0;
      const scoreB = scoreMap.get(b.sku) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      const refA = (a.manufacturerRef || a.sku).toLowerCase();
      const refB = (b.manufacturerRef || b.sku).toLowerCase();
      if (refA !== refB) return refA.localeCompare(refB);
      const colorA = (a.color || "").toLowerCase();
      const colorB = (b.color || "").toLowerCase();
      if (colorA !== colorB) return colorA.localeCompare(colorB);
      return a.sku.localeCompare(b.sku);
    });
    return sorted;
  }, [products, productSearch]);

  async function addLine(product: Product) {
    const basePrice = channel === "B2B" ? product.b2bPrice : product.rrp;
    const quotePrice = await getQuotePrice(
      product.sku,
      channel,
      basePrice ?? null,
    );
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === product.sku);
      if (existing) {
        return prev.map((l) =>
          l.sku === product.sku
            ? {
                ...l,
                quantity: (l.quantity ?? 0) + 1,
                unitPrice: quotePrice ?? l.unitPrice ?? undefined,
              }
            : l,
        );
      }
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          quantity: 1,
          unitPrice: quotePrice ?? undefined,
          discount: 0,
        },
      ];
    });
    setAddToast(`Anadido: ${product.sku}`);
    setTimeout(() => setAddToast(null), 1200);
    setAddedSku(product.sku);
    setTimeout(() => setAddedSku(null), 600);
  }

  async function getQuotePrice(
    sku: string,
    currentChannel: "B2B" | "B2C",
    fallback: number | null,
  ) {
    if (fallback !== null && fallback !== undefined) {
      return fallback;
    }
    const key = `${sku}:${currentChannel}`;
    if (quoteCache.current.has(key)) {
      return quoteCache.current.get(key) ?? fallback;
    }
    try {
      const quote = await api.get<PriceQuote>(
        `/pricing/quote?sku=${encodeURIComponent(sku)}&channel=${currentChannel}`,
      );
      const price = quote.price ?? quote.base ?? fallback ?? null;
      quoteCache.current.set(key, price);
      return price;
    } catch {
      return fallback;
    }
  }

  async function refreshLinePrices(currentLines: Line[]) {
    const updated = await Promise.all(
      currentLines.map(async (line) => {
        const product = products.find((p) => p.sku === line.sku);
        const basePrice = product
          ? channel === "B2B"
            ? product.b2bPrice
            : product.rrp
          : line.unitPrice ?? null;
        const quotePrice = await getQuotePrice(
          line.sku,
          channel,
          basePrice ?? null,
        );
        return { ...line, unitPrice: quotePrice ?? line.unitPrice ?? undefined };
      }),
    );
    setLines(updated);
  }

  function scrollSlider(direction: "left" | "right") {
    if (!sliderRef.current) return;
    const offset = direction === "left" ? -320 : 320;
    sliderRef.current.scrollBy({ left: offset, behavior: "smooth" });
  }

  async function createCustomer() {
    if (!newCustomer.name.trim()) return;
    const created = await api.post<Customer>("/customers", {
      type: "public",
      name: newCustomer.name.trim(),
    });
    setSelectedCustomer(created);
    setCustomers([created]);
    setNewCustomer({ name: "" });
  }

  async function submitSale() {
    setStatus(null);
    if (submitting) return;
    if (!fromId || lines.length === 0) return;
    const saleLines = lines.filter((line) => (line.quantity ?? 0) > 0);
    if (saleLines.length === 0) {
      setStatus("Introduce al menos una cantidad");
      return;
    }
    const isB2B = selectedCustomer?.type === "b2b";
    const depositEnabled = b2bDeposit && isB2B;
    if (!selectedCustomer && b2bDeposit) {
      setB2bDeposit(false);
    }
      const payload = {
        warehouseId: fromId,
        channel: isB2B ? "B2B" : "B2C",
        customerId: selectedCustomer?.id,
        paymentMethod: giftSale ? "Regalo" : depositEnabled ? "Deposito" : paymentMethod,
        paymentStatus,
        paidAmount:
          paymentStatus === "partial" && paidAmount.trim()
            ? Number(paidAmount)
            : undefined,
        notes: depositEnabled ? "DEPOSITO" : undefined,
        date: saleDate,
        giftSale,
        lines: saleLines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity ?? 0,
        unitPrice: (line.unitPrice ?? 0) * (1 - (line.discount ?? 0) / 100),
        addOns: (line.addOns ?? []).map((addOn) => ({
          accessoryId: addOn.accessoryId,
          price: addOn.price ?? 0,
          quantity: addOn.quantity ?? 1,
        })),
      })),
    };
    let created: { id: number } | null = null;
    setSubmitting(true);
    try {
        if (depositEnabled) {
          if (!selectedCustomer) {
            setStatus("Selecciona un cliente para deposito.");
            return;
          }
          const match = retails.find(
            (retail) =>
              retail.name.trim().toLowerCase() ===
              selectedCustomer.name.trim().toLowerCase(),
          );
          let targetId = match?.id;
          if (!targetId) {
            const createdRetail = await api.post<{ id: number }>("/locations", {
              type: "retail",
              name: selectedCustomer.name,
              city: selectedCustomer.city ?? "",
              active: true,
            });
            targetId = createdRetail.id;
            setRetails((prev) => [
              ...prev,
              {
                id: createdRetail.id,
                type: "retail",
                name: selectedCustomer.name,
                city: selectedCustomer.city ?? "",
                active: true,
              },
            ]);
          }
          const transfer = await api.post<{ id: number }>("/moves/transfer", {
            fromId,
            toId: targetId,
            notes: `DEPOSITO${selectedCustomer ? ` | ${selectedCustomer.name}` : ""}`,
            customerId: selectedCustomer?.id,
            lines: saleLines.map((line) => ({
              sku: line.sku,
              quantity: line.quantity ?? 0,
            })),
          });
        created = transfer;
        setLastReportId(transfer.id);
        setLastReportLabel("Deposito");
      } else {
        created = await api.post<{ id: number }>("/pos/sale", payload);
      }
    } catch (err) {
      const message = extractErrorMessage(err);
      const insufficient =
        message.includes("Insufficient stock") ||
        message.includes("No hay stock");
      if (insufficient) {
        const ok = window.confirm(
          "No hay stock suficiente. Quieres continuar y dejar stock negativo?",
        );
        if (ok) {
          if (b2bDeposit) {
            setStatus("No hay stock suficiente para deposito.");
            return;
          }
          try {
            created = await api.post<{ id: number }>("/pos/sale", {
              ...payload,
              allowNegativeStock: true,
            });
          } catch (retryErr) {
            setStatus(extractErrorMessage(retryErr));
            return;
          }
        } else {
          setStatus("No hay stock suficiente. Revisa el stock.");
          return;
        }
      } else {
        setStatus(message);
        return;
      }
    } finally {
      setSubmitting(false);
    }
    setLines([]);
    setToast("Venta finalizada");
    setTimeout(() => setToast(null), 3000);
    setGiftSale(false);
    if (created?.id && !b2bDeposit) {
      setLastReportId(created.id);
      setLastReportLabel("Venta");
    }
  }

  async function submitTransfer() {
    setStatus(null);
    if (submitting) return;
    if (!fromId) {
      setStatus("Selecciona almacen origen");
      return;
    }
    if (!toId) {
      setStatus("Selecciona almacen destino");
      return;
    }
    if (fromId === toId) {
      setStatus("El almacen origen y destino no pueden ser el mismo");
      return;
    }
    if (lines.length === 0) {
      setStatus("Anade productos al traspaso");
      return;
    }
    const transferLines = lines.filter((line) => (line.quantity ?? 0) > 0);
    if (transferLines.length === 0) {
      setStatus("Introduce al menos una cantidad");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/moves/transfer", {
        fromId,
        toId,
        lines: transferLines.map((line) => ({
          sku: line.sku,
          quantity: line.quantity ?? 0,
        })),
      });
      setLines([]);
      setToast("Traspaso procesado");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setStatus(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWaste() {
    setStatus(null);
    if (submitting) return;
    if (!fromId || lines.length === 0) return;
    const wasteLines = lines.filter((line) => (line.quantity ?? 0) > 0);
    if (wasteLines.length === 0) {
      setStatus("Introduce al menos una cantidad");
      return;
    }
    if (!wasteReason.trim()) {
      setStatus("Indica el motivo de la merma/rotura");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/moves/adjust", {
        locationId: fromId,
        direction: "out",
        date: wasteDate,
        notes: `MERMA | ${wasteReason.trim()}`,
        lines: wasteLines.map((line) => ({
          sku: line.sku,
          quantity: line.quantity ?? 0,
        })),
      });
      setLines([]);
      setWasteReason("");
      setToast("Merma registrada");
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setStatus(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitReturn() {
    setStatus(null);
    if (submitting) return;
    if (!returnOrderId) {
      setStatus("Selecciona un pedido para devolver");
      return;
    }
    if (!returnWarehouseId) {
      setStatus("Selecciona un almacen para la devolucion");
      return;
    }

    const payloadLines = returnLines
      .filter((line) => (line.quantity ?? 0) > 0)
      .map((line) => ({ sku: line.sku, quantity: line.quantity ?? 0 }));

    if (payloadLines.length === 0) {
      setStatus("Introduce al menos una cantidad a devolver");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<{ id: number }>("/pos/return", {
        saleId: returnOrderId,
        warehouseId: returnWarehouseId,
        date: returnDate,
        lines: payloadLines,
      });
      setReturnLines((prev) => prev.map((line) => ({ ...line, quantity: 0 })));
      await loadReturnOrders();
      setToast("Devoluci\u00f3n registrada");
      setTimeout(() => setToast(null), 3000);
      if (created?.id) {
        setLastReportId(created.id);
        setLastReportLabel("Devolucion");
      }
    } catch (err) {
      setStatus(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadLastReport(type: "ticket" | "invoice" | "delivery") {
    if (!lastReportId) return;
    try {
      setStatus(null);
      const blob = await api.download(`/reports/moves/${lastReportId}/${type}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const fileLabel = type === "delivery" ? "albaran" : type;
      link.download = `${fileLabel}-${lastReportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    }
  }

  return (
    <div className="stack pos-shell">
      <h2 className="pos-title">TPV / Pedidos</h2>
      <div className="card pos-topbar">
        <div>
          <span className="pos-label">Almacen</span>
          <div className="pos-topbar-value pos-strong">
            {warehouses.find((w) => w.id === fromId)?.name ?? "-"}
          </div>
        </div>
        <div>
          <span className="pos-label">Metodo</span>
          <div className="pos-topbar-value pos-strong">{paymentMethod || "-"}</div>
        </div>
      </div>
      <div className="card row pos-mode-tabs">
        <button
          className={`btn-lg tab-button ${mode === "sale" ? "active" : ""}`}
          onClick={() => setMode("sale")}
        >
          Venta
        </button>
        <button
          className={`btn-lg tab-button ${mode === "transfer" ? "active" : ""}`}
          onClick={() => setMode("transfer")}
        >
          Traspaso
        </button>
        <button
          className={`btn-lg tab-button ${mode === "return" ? "active" : ""}`}
          onClick={() => setMode("return")}
        >
          Devolucion
        </button>
        <button
          className={`btn-lg tab-button ${mode === "waste" ? "active" : ""}`}
          onClick={() => setMode("waste")}
        >
          Baja
        </button>
      </div>

      {mode === "return" && (
        <div className="card stack section-card">
          <div className="section-title pos-section-title">
            <span className="section-number">1</span>
            <strong className="pos-section-heading">Devolucion</strong>
          </div>
          <div className="row">
            <label className="stack">
              <span className="muted">Buscar pedido</span>
              <input
                className="input"
                value={returnSearchTerm}
                onChange={(e) => setReturnSearchTerm(e.target.value)}
                placeholder="Referencia, fecha o ID"
              />
            </label>
            <label className="stack">
              <span className="muted">Pedido</span>
              <select
                className="input"
                value={returnOrderId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  if (!id) {
                    setReturnOrderId(null);
                    setReturnWarehouseId(null);
                    setReturnLines([]);
                    return;
                  }
                  selectReturnOrder(id);
                }}
              >
                <option value="">Selecciona un pedido</option>
                {filteredReturnOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.reference ?? `#${order.id}`} Â·{" "}
                    {new Date(order.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              onClick={() =>
                loadReturnOrders().catch((err) =>
                  setStatus(err instanceof Error ? err.message : String(err)),
                )
              }
            >
              Actualizar
            </button>
          </div>
          <div className="row">
            <label className="stack">
              <span className="muted">Almacen</span>
              <select
                className="input"
                value={returnWarehouseId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setReturnWarehouseId(Number.isNaN(id) ? null : id);
                }}
              >
                <option value="">Selecciona un almacen</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="stack">
              <span className="muted">Fecha devolucion</span>
              <input
                className="input"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
              />
            </label>
          </div>
          {returnLoading && <p className="muted">Cargando pedido...</p>}
          {!returnLoading && returnLines.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Vendido</th>
                  <th>Devolver</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {returnLines.map((line) => (
                  <tr key={line.sku}>
                    <td>{line.sku}</td>
                    <td>{line.name}</td>
                    <td>{line.soldQty}</td>
                    <td>
                      <input
                        className="input input-compact"
                        type="number"
                        min={0}
                        max={line.soldQty}
                        value={line.quantity ?? ""}
                        onChange={(e) =>
                          setReturnLines((prev) =>
                            prev.map((l) =>
                              l.sku === line.sku
                                ? {
                                    ...l,
                                    quantity: parseNumberInput(e.target.value),
                                  }
                                : l,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>{line.unitPrice ?? "-"}</td>
                    <td>
                      {((line.unitPrice ?? 0) * (line.quantity ?? 0)).toFixed(
                        2,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!returnLoading && returnLines.length === 0 && (
            <p className="muted">Selecciona un pedido para ver lineas</p>
          )}
          <div className="row summary-actions">
            <strong className="pos-strong">
              Total devolucion: {returnTotal.toFixed(2)}
            </strong>
            <button onClick={submitReturn} disabled={submitting}>
              {submitting ? "Procesando..." : "Procesar devolucion"}
            </button>
          </div>
          {lastReportId && lastReportLabel === "Devolucion" && (
            <div className="row">
              <button
                className="secondary"
                type="button"
                onClick={() => downloadLastReport("ticket")}
              >
                Ver ticket
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => downloadLastReport("invoice")}
              >
                Ver factura
              </button>
            </div>
          )}
          {lastReportId && lastReportLabel === "Deposito" && (
            <div className="row">
              <button
                className="secondary"
                type="button"
                onClick={() => downloadLastReport("delivery")}
              >
                Ver albaran
              </button>
            </div>
          )}
          {status && <p className="inline-error">{status}</p>}
        </div>
      )}

      {mode !== "return" && (
        <>
          <div className="card stack section-card">
            <div className="section-title pos-section-title">
              <span className="section-number">1</span>
              <strong className="pos-section-heading">
                {mode === "sale"
                  ? "Cliente"
                  : mode === "transfer"
                  ? "Traspaso"
                  : "Baja de stock"}
              </strong>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Almacen</span>
                <select
                  className="input"
                  value={fromId ?? ""}
                  onChange={(e) => setFromId(Number(e.target.value))}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "sale" && (
                <label className="stack">
                  <span className="muted">Fecha</span>
                  <input
                    className="input"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </label>
              )}
              {mode === "sale" && (
                <label className="stack">
                  <span className="muted">Metodo de pago</span>
                  <select
                    className="input"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    disabled={giftSale}
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "sale" && (
                <label className="stack">
                  <span className="muted">Estado pago</span>
                  <select
                    className="input"
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(e.target.value as "paid" | "pending" | "partial")
                    }
                    disabled={giftSale}
                  >
                    <option value="paid">Pagado</option>
                    <option value="pending">Pendiente</option>
                    <option value="partial">Parcial</option>
                  </select>
                </label>
              )}
              {mode === "sale" && paymentStatus === "partial" && (
                <label className="stack">
                  <span className="muted">Pagado</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                  />
                </label>
              )}
              {mode === "sale" && (
                <label className="stack">
                  <span className="muted">Regalo</span>
                  <div className="row">
                    <input
                      type="checkbox"
                      checked={giftSale}
                      onChange={(e) => setGiftSale(e.target.checked)}
                    />
                    <span className="muted">Sin cobro</span>
                  </div>
                </label>
              )}
              {mode === "sale" && channel === "B2B" && (
                <label className="stack">
                  <span className="muted">Deposito</span>
                  <div className="row">
                    <input
                      type="checkbox"
                      checked={b2bDeposit}
                      onChange={(e) => setB2bDeposit(e.target.checked)}
                    />
                    <span className="muted">Marcar en deposito</span>
                  </div>
                </label>
              )}
              {mode === "sale" && channel === "B2B" && b2bDeposit && null}
              {mode === "transfer" && (
                <label className="stack">
                  <span className="muted">Destino</span>
                  <select
                    className="input"
                    value={toId ?? ""}
                    onChange={(e) => setToId(Number(e.target.value))}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "waste" && (
                <label className="stack">
                  <span className="muted">Fecha</span>
                  <input
                    className="input"
                    type="date"
                    value={wasteDate}
                    onChange={(e) => setWasteDate(e.target.value)}
                  />
                </label>
              )}
            </div>
            {mode === "waste" && (
              <div className="row">
                <label className="stack" style={{ flex: 1 }}>
                  <span className="muted">Motivo (obligatorio)</span>
                  <input
                    className="input"
                    value={wasteReason}
                    onChange={(e) => setWasteReason(e.target.value)}
                    placeholder="Ej: montura rota, lente rayada..."
                  />
                </label>
              </div>
            )}

            {mode === "sale" && (
              <div className="stack">
                <div className="row">
                  <label className="stack">
                    <span className="muted">Buscar cliente</span>
                    <input
                      className="input"
                      placeholder="Buscar cliente"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                  </label>
                  <label className="stack">
                    <span className="muted">Cliente seleccionado</span>
                    <select
                      className="input"
                      value={selectedCustomer?.id ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedCustomer(
                          customers.find((c) => c.id === id) ?? null,
                        );
                      }}
                    >
                      <option value="">Sin cliente</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({customerTypeLabel(c.type)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="stack">
                    <span className="muted">Venta sin cliente</span>
                    <div className="row">
                      <input
                        type="checkbox"
                        checked={selectedCustomer === null}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCustomer(null);
                          }
                        }}
                      />
                      <span className="muted">Sin cliente</span>
                    </div>
                  </label>
                </div>
                <div className="row">
                  <label className="stack">
                    <span className="muted">Nuevo cliente</span>
                    <input
                      className="input"
                      placeholder="Nuevo cliente"
                      value={newCustomer.name}
                      onChange={(e) =>
                        setNewCustomer({ ...newCustomer, name: e.target.value })
                      }
                    />
                  </label>
                  <button className="secondary" onClick={createCustomer}>
                    Crear cliente
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card stack section-card">
            <div className="section-title pos-section-title">
              <span className="section-number">2</span>
              <strong className="pos-section-heading">Productos</strong>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Buscar producto</span>
                <input
                  className="input"
                  placeholder="Buscar producto"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </label>
            </div>
            {productsLoading && <p className="muted">Cargando productos...</p>}
            {!productsLoading && productSearch.trim().length > 0 && (
              <div className="tpv-results">
                <div className="tpv-slider-wrap">
                  <button
                    className="tpv-scroll"
                    type="button"
                    onClick={() => scrollSlider("left")}
                  >
                    {"<"}
                  </button>
                  <div className="tpv-slider" ref={sliderRef}>
                  {flatResults.map((item) => (
                    <button
                      key={item.sku}
                      className={`tpv-card ${addedSku === item.sku ? "added" : ""}`}
                      onClick={() => addLine(item)}
                      type="button"
                    >
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} />
                      ) : (
                        <div className="tpv-card-placeholder">Sin imagen</div>
                      )}
                      <div className="tpv-card-meta">
                        <div className="tpv-card-sku">{item.sku}</div>
                        <div className="tpv-card-ref">
                          {item.manufacturerRef || item.sku}
                        </div>
                        <div className="tpv-card-color">{item.color || "-"}</div>
                      </div>
                    </button>
                  ))}
                  </div>
                  <button
                    className="tpv-scroll"
                    type="button"
                    onClick={() => scrollSlider("right")}
                  >
                    {">"}
                  </button>
                </div>
                {flatResults.length === 0 && (
                  <p className="muted">Sin resultados</p>
                )}
              </div>
            )}
            {!productsLoading && productSearch.trim().length === 0 && (
              <p className="muted">
                Escribe en el buscador para ver productos.
              </p>
            )}
          </div>

          <div className="pos-layout">
            <div className="card stack section-card pos-main">
              <div className="section-title pos-section-title">
                <span className="section-number">3</span>
                <strong className="pos-section-heading">Resumen</strong>
              </div>
              <div className={`line-grid header ${mode}`}>
                <div>SKU</div>
                <div>Nombre</div>
                <div>Cantidad</div>
                {mode === "sale" && <div>Precio</div>}
                {mode === "sale" && <div>Desc %</div>}
                <div>Subtotal</div>
                <div></div>
              </div>
              {lines.map((line) => {
                const price = line.unitPrice ?? 0;
                const discount = line.discount ?? 0;
                const qty = line.quantity ?? 0;
                const addOnTotal = (line.addOns ?? []).reduce(
                  (sum, addOn) => sum + (addOn.price ?? 0) * (addOn.quantity ?? 1),
                  0,
                );
                const addOnEffective = qty > 0 ? addOnTotal : 0;
                const subtotal =
                  price * (1 - discount / 100) * qty + addOnEffective;
                return (
                  <div key={line.sku}>
                    <div className={`line-grid ${mode}`}>
                      <div className="line-sku">{line.sku}</div>
                      <div className="line-name">{line.name}</div>
                      <div className="qty-controls">
                        <input
                          className="input input-compact"
                          type="number"
                          value={line.quantity ?? ""}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.sku === line.sku
                                  ? {
                                      ...l,
                                      quantity: parseNumberInput(e.target.value),
                                    }
                                  : l,
                              ),
                            )
                          }
                        />
                      </div>
                      {mode === "sale" && (
                        <div>
                          <input
                            className="input input-compact"
                            type="number"
                            value={line.unitPrice ?? ""}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.sku === line.sku
                                    ? {
                                        ...l,
                                        unitPrice: parseNumberInput(
                                          e.target.value,
                                        ),
                                      }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      )}
                      {mode === "sale" && (
                        <div>
                          <input
                            className="input input-compact"
                            type="number"
                            value={line.discount ?? ""}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.sku === line.sku
                                    ? {
                                        ...l,
                                        discount: parseNumberInput(
                                          e.target.value,
                                        ),
                                      }
                                    : l,
                                ),
                              )
                            }
                          />
                        </div>
                      )}
                      <div className="line-subtotal">
                        {mode === "sale" ? subtotal.toFixed(2) : "-"}
                      </div>
                      <div className="line-actions">
                        <button
                          className="icon-button"
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.sku !== line.sku),
                            )
                          }
                        >
                          X
                        </button>
                      </div>
                    </div>
                    {mode === "sale" && (
                      <div className="line-addons-row">
                        <button
                          className="secondary"
                          type="button"
                          onClick={() => setEditingAddOnsSku(line.sku)}
                        >
                          Accesorios
                        </button>
                        {line.addOns && line.addOns.length > 0 && (
                          <div className="addon-tags">
                            {line.addOns.map((item) => (
                              <span key={item.accessoryId} className="chip">
                                {item.name} x{item.quantity ?? 1}
                                {item.price !== null ? ` (EUR ${item.price})` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {lines.length === 0 && (
                <div className={`line-grid ${mode}`}>
                  <div className="muted">Sin lineas</div>
                </div>
              )}
              <div className="row summary-actions">
                {mode === "sale" && (
                  <strong className="pos-strong">Total: {total.toFixed(2)}</strong>
                )}
                {mode === "transfer" && (
                  <button onClick={submitTransfer} disabled={submitting}>
                    {submitting ? "Procesando..." : "Procesar traspaso"}
                  </button>
                )}
                {mode === "waste" && (
                  <button onClick={submitWaste} disabled={submitting}>
                    {submitting ? "Procesando..." : "Registrar merma"}
                  </button>
                )}
              </div>
              {lastReportId && lastReportLabel === "Venta" && (
                <div className="row">
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => downloadLastReport("ticket")}
                  >
                    Ver ticket
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => downloadLastReport("invoice")}
                  >
                    Ver factura
                  </button>
                </div>
              )}
              {status && <p className="inline-error">{status}</p>}
            </div>

            {mode === "sale" && (
              <aside className="pos-summary">
                <div className="pos-summary-inner">
                  <div className="pos-summary-title">Resumen</div>
                  <div className="pos-summary-total">{total.toFixed(2)} EUR</div>
                  <div className="pos-summary-breakdown">
                    <span className="muted">Lineas</span>
                    <span>{lines.length}</span>
                    <span className="muted">Descuento</span>
                    <span>
                      {lines
                        .reduce((acc, line) => acc + (line.discount ?? 0), 0)
                        .toFixed(0)}
                      %
                    </span>
                  </div>
                  <button
                    className="pos-summary-action"
                    onClick={submitSale}
                    disabled={submitting}
                  >
                    {submitting ? "Procesando..." : "Finalizar venta"}
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
      {addToast && <div className="toast toast-compact">{addToast}</div>}

      {editingAddOnsSku && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingAddOnsSku(null)}
        >
          <div
            className="card stack modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <strong>Accesorios</strong>
            <div className="muted">
              Linea: {editingAddOnsSku}
            </div>
            <div className="stack">
              {accessories.length === 0 && (
                <p className="muted">No hay accesorios activos.</p>
              )}
              {accessories.length > 0 && (
                <div
                  className="muted"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 120px",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  <span>Accesorio</span>
                  <span>Precio</span>
                  <span>Cantidad</span>
                </div>
              )}
              {accessories.map((acc) => {
                const line = lines.find((l) => l.sku === editingAddOnsSku);
                const existing =
                  line?.addOns?.find((a) => a.accessoryId === acc.id) ?? null;
                return (
                  <div
                    key={acc.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 120px 120px",
                      gap: "12px",
                      alignItems: "center",
                    }}
                  >
                    <label className="row" style={{ gap: "8px" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(existing)}
                        onChange={(e) =>
                          toggleAddOn(editingAddOnsSku, acc, e.target.checked)
                        }
                      />
                      {acc.name}
                    </label>
                    <input
                      className="input input-compact"
                      type="number"
                      placeholder="0"
                      value={existing?.price ?? 0}
                      onChange={(e) =>
                        updateAddOnPrice(
                          editingAddOnsSku,
                          acc.id,
                          parseNumberInput(e.target.value) ?? 0,
                        )
                      }
                      disabled={!existing}
                    />
                    <input
                      className="input input-compact"
                      type="number"
                      placeholder="1"
                      value={existing?.quantity ?? 1}
                      onChange={(e) =>
                        updateAddOnQuantity(
                          editingAddOnsSku,
                          acc.id,
                          parseNumberInput(e.target.value) ?? 1,
                        )
                      }
                      disabled={!existing}
                    />
                  </div>
                );
              })}
            </div>
            <div className="row">
              <button onClick={() => setEditingAddOnsSku(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
