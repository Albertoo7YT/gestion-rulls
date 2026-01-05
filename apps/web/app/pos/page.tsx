"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";

type Product = {
  sku: string;
  name: string;
  manufacturerRef?: string | null;
  color?: string | null;
  photoUrl?: string | null;
  rrp: number | null;
  b2bPrice: number | null;
};

type Location = { id: number; name: string; type: "warehouse" | "retail" };

type Customer = { id: number; name: string; type: "b2b" | "public" };
type PaymentMethod = { id: number; name: string };

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
};

type ReturnLine = {
  sku: string;
  name: string;
  soldQty: number;
  quantity: number | null;
  unitPrice: number | null;
};

export default function PosPage() {
  const [mode, setMode] = useState<"sale" | "transfer" | "return">("sale");
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addToast, setAddToast] = useState<string | null>(null);
  const [giftSale, setGiftSale] = useState(false);
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const [lastReportId, setLastReportId] = useState<number | null>(null);
  const [lastReportLabel, setLastReportLabel] = useState("");
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";
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

  async function selectReturnOrder(id: number) {
    setReturnLoading(true);
    try {
      const detail = await api.get<MoveDetail>(`/moves/${id}`);
      setReturnOrderId(detail.id);
      setReturnWarehouseId(detail.fromId ?? null);
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
      api.get<PaymentMethod[]>("/payment-methods"),
      api.get<MoveSummary[]>("/moves?types=b2b_sale,b2c_sale"),
    ])
      .then(([p, w, pm, moves]) => {
        setProducts(p);
        setWarehouses(w);
        setPaymentMethods(pm);
        setReturnOrders(moves);
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

  const parseNumberInput = (value: string) => {
    if (value === "") return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

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
      return sum + effective * qty;
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

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      `${p.sku} ${p.name} ${p.manufacturerRef ?? ""} ${p.color ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [products, productSearch]);

  const flatResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return [];
    const sorted = [...filteredProducts];
    sorted.sort((a, b) => {
      const aExact = a.sku.toLowerCase() === term ? 1 : 0;
      const bExact = b.sku.toLowerCase() === term ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      const aRef = (a.manufacturerRef || "").toLowerCase() === term ? 1 : 0;
      const bRef = (b.manufacturerRef || "").toLowerCase() === term ? 1 : 0;
      if (aRef !== bRef) return bRef - aRef;
      const refA = (a.manufacturerRef || a.sku).toLowerCase();
      const refB = (b.manufacturerRef || b.sku).toLowerCase();
      if (refA !== refB) return refA.localeCompare(refB);
      const colorA = (a.color || "").toLowerCase();
      const colorB = (b.color || "").toLowerCase();
      if (colorA !== colorB) return colorA.localeCompare(colorB);
      return a.sku.localeCompare(b.sku);
    });
    return sorted;
  }, [filteredProducts, productSearch]);

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
    if (!fromId || lines.length === 0) return;
    const saleLines = lines.filter((line) => (line.quantity ?? 0) > 0);
    if (saleLines.length === 0) {
      setStatus("Introduce al menos una cantidad");
      return;
    }
    const payload = {
      warehouseId: fromId,
      channel,
      customerId: selectedCustomer?.id,
      paymentMethod: giftSale ? "Regalo" : paymentMethod,
      date: saleDate,
      giftSale,
      lines: saleLines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity ?? 0,
        unitPrice: (line.unitPrice ?? 0) * (1 - (line.discount ?? 0) / 100),
      })),
    };
    let created: { id: number } | null = null;
    try {
      created = await api.post<{ id: number }>("/pos/sale", payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const insufficient =
        message.includes("Insufficient stock") ||
        message.includes("No hay stock");
      if (insufficient) {
        const ok = window.confirm(
          "No hay stock suficiente. Â¿Quieres continuar y dejar stock negativo?",
        );
        if (ok) {
          created = await api.post<{ id: number }>("/pos/sale", {
            ...payload,
            allowNegativeStock: true,
          });
        } else {
          setStatus("No hay stock suficiente. Revisa el stock.");
          return;
        }
      } else {
        throw err;
      }
    }
    setLines([]);
    setToast("Venta finalizada");
    setTimeout(() => setToast(null), 3000);
    setGiftSale(false);
    if (created?.id) {
      setLastReportId(created.id);
      setLastReportLabel("Venta");
    }
  }

  async function submitTransfer() {
    setStatus(null);
    if (!fromId || !toId || lines.length === 0) return;
    const transferLines = lines.filter((line) => (line.quantity ?? 0) > 0);
    if (transferLines.length === 0) {
      setStatus("Introduce al menos una cantidad");
      return;
    }
    await api.post("/moves/transfer", {
      fromId,
      toId,
      lines: transferLines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity ?? 0,
      })),
    });
    setLines([]);
  }

  async function submitReturn() {
    setStatus(null);
    if (!returnOrderId) {
      setStatus("Selecciona un pedido para devolver");
      return;
    }

    const payloadLines = returnLines
      .filter((line) => (line.quantity ?? 0) > 0)
      .map((line) => ({ sku: line.sku, quantity: line.quantity ?? 0 }));

    if (payloadLines.length === 0) {
      setStatus("Introduce al menos una cantidad a devolver");
      return;
    }

    const created = await api.post<{ id: number }>("/pos/return", {
      saleId: returnOrderId,
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
              <input
                className="input"
                value={
                  warehouses.find((w) => w.id === returnWarehouseId)?.name ??
                  "-"
                }
                readOnly
              />
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
            <button onClick={submitReturn}>Procesar devolucion</button>
          </div>
          {lastReportId && lastReportLabel === "Devolucion" && (
            <div className="row">
              <a
                className="secondary"
                href={`${apiBase}/reports/moves/${lastReportId}/ticket`}
                target="_blank"
                rel="noreferrer"
              >
                Ver ticket
              </a>
              <a
                className="secondary"
                href={`${apiBase}/reports/moves/${lastReportId}/invoice`}
                target="_blank"
                rel="noreferrer"
              >
                Ver factura
              </a>
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
              <strong className="pos-section-heading">Cliente</strong>
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
            </div>

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
                          {c.name} ({c.type})
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
                const subtotal = price * (1 - discount / 100) * qty;
                return (
                  <div key={line.sku} className={`line-grid ${mode}`}>
                    <div>{line.sku}</div>
                    <div>{line.name}</div>
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
                    <div>
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
                {mode !== "sale" && (
                  <button onClick={submitTransfer}>Procesar traspaso</button>
                )}
              </div>
              {lastReportId && lastReportLabel === "Venta" && (
                <div className="row">
                  <a
                    className="secondary"
                    href={`${apiBase}/reports/moves/${lastReportId}/ticket`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver ticket
                  </a>
                  <a
                    className="secondary"
                    href={`${apiBase}/reports/moves/${lastReportId}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver factura
                  </a>
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
                  <button className="pos-summary-action" onClick={submitSale}>
                    Finalizar venta
                  </button>
                </div>
              </aside>
            )}
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
      {addToast && <div className="toast toast-compact">{addToast}</div>}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
