"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type WebOrder = {
  wooOrderId: string;
  number: string;
  status: string;
  createdAtWoo: string;
  customerName: string;
  total: string;
  currency: string;
  processedAt?: string | null;
};

type PosOrder = {
  id: number;
  type: string;
  date: string;
  reference?: string | null;
  seriesCode?: string | null;
  seriesYear?: number | null;
  seriesNumber?: number | null;
  buyer?: string;
  units?: number;
  total?: number;
  paymentStatus?: "pending" | "partial" | "paid";
  paidAmount?: number;
};

type PagedMoves = {
  items: PosOrder[];
  total: number;
  page: number;
  pageSize: number;
};

type DocumentSeries = {
  code: string;
  name: string;
  scope: string;
  prefix?: string | null;
  year?: number | null;
  nextNumber: number;
  padding: number;
  active: boolean;
};

type DepositCustomer = {
  customerId: number;
  name: string;
  units: number;
  cost: number;
};

type DepositDetail = {
  customer: { id: number; name: string };
  retail: { id: number; name: string };
  items: { sku: string; name: string; quantity: number; cost: number }[];
};

type Location = { id: number; name: string; type: string };

const SERIES_SCOPE_OPTIONS = [
  { value: "sale_b2c", label: "Ventas B2C" },
  { value: "sale_b2b", label: "Ventas B2B" },
  { value: "return", label: "Devoluciones" },
  { value: "deposit", label: "Depositos" },
  { value: "web", label: "Web" },
];

export default function OrdersPage() {
  const [webOrders, setWebOrders] = useState<WebOrder[]>([]);
  const [posOrders, setPosOrders] = useState<PosOrder[]>([]);
  const [posTotal, setPosTotal] = useState(0);
  const [posPage, setPosPage] = useState(1);
  const [posPageSize, setPosPageSize] = useState(25);
  const [posQuery, setPosQuery] = useState("");
  const [posType, setPosType] = useState("");
  const [posSeries, setPosSeries] = useState("");
  const [posFrom, setPosFrom] = useState("");
  const [posTo, setPosTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [selectedMove, setSelectedMove] = useState<any | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPaymentStatus, setEditPaymentStatus] = useState<
    "pending" | "partial" | "paid"
  >("pending");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [selectedWebOrders, setSelectedWebOrders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPosOrders, setSelectedPosOrders] = useState<Set<number>>(
    new Set(),
  );
  const [depositCustomers, setDepositCustomers] = useState<DepositCustomer[]>(
    [],
  );
  const [depositDetail, setDepositDetail] = useState<DepositDetail | null>(null);
  const [depositWarehouses, setDepositWarehouses] = useState<Location[]>([]);
  const [depositWarehouseId, setDepositWarehouseId] = useState<number | null>(
    null,
  );
  const [depositSaleLines, setDepositSaleLines] = useState<Record<string, number>>(
    {},
  );
  const [depositSaleQty, setDepositSaleQty] = useState<Record<string, number>>(
    {},
  );
  const [depositReturnLines, setDepositReturnLines] = useState<
    Record<string, number>
  >({});
  const [seriesModalOpen, setSeriesModalOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<DocumentSeries[]>([]);
  const [newSeries, setNewSeries] = useState<Partial<DocumentSeries>>({
    scope: "sale_b2c",
    active: true,
    padding: 6,
    nextNumber: 1,
  });
  const filtersActive = Boolean(
    posQuery.trim() ||
      posType.trim() ||
      posSeries.trim() ||
      posFrom ||
      posTo,
  );

  useEffect(() => {
    Promise.all([
      api.get<WebOrder[]>("/web-orders"),
      api.get<DepositCustomer[]>("/deposits/customers"),
      api.get<Location[]>("/locations"),
    ])
      .then(([web, deposits, locations]) => {
        setWebOrders(web);
        setDepositCustomers(deposits);
        const warehouses = locations.filter((loc) => loc.type === "warehouse");
        setDepositWarehouses(warehouses);
        setDepositWarehouseId(warehouses[0]?.id ?? null);
        const webIds = new Set(web.map((o) => o.wooOrderId));
        setSelectedWebOrders(
          (prev) =>
            new Set(Array.from(prev).filter((id) => webIds.has(id))),
        );
      })
      .catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    loadPosOrders().catch((err) => setStatus(err.message));
  }, [posPage, posPageSize, posQuery, posType, posSeries, posFrom, posTo]);

  async function loadPosOrders() {
    const params = new URLSearchParams();
    const defaultTypes =
      posType ||
      "transfer,b2b_sale,b2c_sale,b2b_return,b2c_return";
    params.set("types", defaultTypes);
    if (posQuery.trim()) params.set("q", posQuery.trim());
    if (posSeries.trim()) params.set("series", posSeries.trim());
    if (posFrom) params.set("from", posFrom);
    if (posTo) params.set("to", posTo);
    params.set("page", String(posPage));
    params.set("limit", String(posPageSize));

    const data = await api.get<PagedMoves | PosOrder[]>(
      `/moves?${params.toString()}`,
    );
    const moves = Array.isArray(data) ? data : data.items;
    const total = Array.isArray(data) ? data.length : data.total;
    const sorted = [...moves].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.id ?? 0) - (a.id ?? 0);
    });

    setPosOrders(sorted);
    setPosTotal(total);
    const moveIds = new Set(sorted.map((m) => m.id));
    setSelectedPosOrders(
      (prev) => new Set(Array.from(prev).filter((id) => moveIds.has(id))),
    );
  }

  async function refreshPosOrders() {
    setStatus(null);
    await loadPosOrders();
  }

  function resetPosFilters() {
    setPosQuery("");
    setPosType("");
    setPosSeries("");
    setPosFrom("");
    setPosTo("");
    setPosPage(1);
  }

  async function loadSeries() {
    const data = await api.get<DocumentSeries[]>("/document-series");
    setSeriesList(data);
  }

  async function loadDepositCustomers() {
    const deposits = await api.get<DepositCustomer[]>("/deposits/customers");
    setDepositCustomers(deposits);
  }

  async function loadDepositDetail(customerId: number) {
    const detail = await api.get<DepositDetail>(
      `/deposits/customers/${customerId}`,
    );
    setDepositDetail(detail);
    setDepositSaleLines({});
    setDepositSaleQty({});
    setDepositReturnLines({});
  }

  const allWebSelected =
    webOrders.length > 0 &&
    webOrders.every((o) => selectedWebOrders.has(o.wooOrderId));
  const allPosSelected =
    posOrders.length > 0 &&
    posOrders.every((o) => selectedPosOrders.has(o.id));

  function toggleWebOrder(id: string) {
    setSelectedWebOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePosOrder(id: number) {
    setSelectedPosOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllWebOrders() {
    setSelectedWebOrders((prev) => {
      const next = new Set(prev);
      if (allWebSelected) {
        webOrders.forEach((o) => next.delete(o.wooOrderId));
      } else {
        webOrders.forEach((o) => next.add(o.wooOrderId));
      }
      return next;
    });
  }

  function toggleAllPosOrders() {
    setSelectedPosOrders((prev) => {
      const next = new Set(prev);
      if (allPosSelected) {
        posOrders.forEach((o) => next.delete(o.id));
      } else {
        posOrders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  }

  async function deleteSelectedWebOrders() {
    if (selectedWebOrders.size === 0) return;
    const ok = window.confirm(
      `Eliminar ${selectedWebOrders.size} pedidos web?`,
    );
    if (!ok) return;
    setStatus(null);
    const ids = Array.from(selectedWebOrders);
    await Promise.all(ids.map((id) => api.del(`/web-orders/${id}`)));
    const refreshed = await api.get<WebOrder[]>("/web-orders");
    setWebOrders(refreshed);
    setSelectedWebOrders(new Set());
  }

  async function deleteSelectedPosOrders() {
    if (selectedPosOrders.size === 0) return;
    const ok = window.confirm(
      `Eliminar ${selectedPosOrders.size} pedidos?`,
    );
    if (!ok) return;
    setStatus(null);
    const ids = Array.from(selectedPosOrders);
    await Promise.all(ids.map((id) => api.del(`/moves/${id}`)));
    await loadPosOrders();
    setSelectedPosOrders(new Set());
  }

  async function openMove(id: number) {
    setSelectedMoveId(id);
    const data = await api.get<any>(`/moves/${id}`);
    setSelectedMove(data);
    setEditReference(data.reference ?? "");
    setEditNotes(data.notes ?? "");
    setEditDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : "");
    setEditPaymentStatus(
      (data.paymentStatus as "pending" | "partial" | "paid") ?? "pending",
    );
    setEditPaidAmount(
      data.paidAmount !== undefined && data.paidAmount !== null
        ? String(data.paidAmount)
        : "",
    );
  }

  function getMoveTotal(move: any | null) {
    if (!move?.lines?.length) return 0;
    return move.lines.reduce((sum: number, line: any) => {
      const price = line.unitPrice ? Number(line.unitPrice) : 0;
      const addOn = line.addOnPrice ? Number(line.addOnPrice) : 0;
      return sum + price * Number(line.quantity ?? 0) + addOn;
    }, 0);
  }

  async function saveMove() {
    if (!selectedMoveId) return;
    const total = getMoveTotal(selectedMove);
    if (editPaymentStatus === "partial") {
      const paid = Number(editPaidAmount);
      if (!editPaidAmount || Number.isNaN(paid) || paid <= 0 || paid >= total) {
        setStatus("El pago parcial debe ser mayor que 0 y menor que el total.");
        return;
      }
    }
    const paidAmount =
      editPaymentStatus === "partial" && editPaidAmount !== ""
        ? Number(editPaidAmount)
        : undefined;
    await api.put(`/moves/${selectedMoveId}`, {
      reference: editReference || undefined,
      notes: editNotes || undefined,
      date: editDate || undefined,
      paymentStatus: editPaymentStatus,
      paidAmount,
    });
    const refreshed = await api.get<any>(`/moves/${selectedMoveId}`);
    setSelectedMove(refreshed);
    await loadPosOrders();
    setSelectedMove(null);
  }

  async function downloadReport(id: number, type: "ticket" | "invoice") {
    try {
      setStatus(null);
      const blob = await api.download(`/reports/moves/${id}/${type}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    }
  }

  async function convertDeposit() {
    if (!depositDetail) return;
    const lines = Object.entries(depositSaleLines)
      .map(([sku, price]) => ({
        sku,
        price,
        qty: depositSaleQty[sku] ?? 0,
      }))
      .filter((line) => line.price > 0 && line.qty > 0)
      .map((line) => ({
        sku: line.sku,
        quantity: line.qty,
        unitPrice: line.price,
      }));
    if (!lines.length) {
      setStatus("Introduce un precio de venta para convertir.");
      return;
    }
    await api.post(`/deposits/customers/${depositDetail.customer.id}/convert`, {
      lines,
    });
    await loadDepositDetail(depositDetail.customer.id);
    await loadDepositCustomers();
  }

  async function returnDeposit() {
    if (!depositDetail || !depositWarehouseId) return;
    const lines = Object.entries(depositReturnLines)
      .filter(([, qty]) => qty > 0)
      .map(([sku, qty]) => ({ sku, quantity: qty }));
    if (!lines.length) {
      setStatus("Indica cantidades a devolver.");
      return;
    }
    await api.post(`/deposits/customers/${depositDetail.customer.id}/return`, {
      warehouseId: depositWarehouseId,
      lines,
    });
    await loadDepositDetail(depositDetail.customer.id);
    await loadDepositCustomers();
  }

  async function openSeriesModal() {
    setSeriesModalOpen(true);
    await loadSeries();
  }

  async function createSeries() {
    if (!newSeries.code || !newSeries.name || !newSeries.scope) {
      setStatus("Completa codigo, nombre y scope.");
      return;
    }
    await api.post("/document-series", {
      code: newSeries.code,
      name: newSeries.name,
      scope: newSeries.scope,
      prefix: newSeries.prefix || undefined,
      year: newSeries.year ?? undefined,
      nextNumber: newSeries.nextNumber ?? 1,
      padding: newSeries.padding ?? 6,
      active: newSeries.active ?? true,
    });
    setNewSeries({ active: true, padding: 6, nextNumber: 1 });
    await loadSeries();
  }

  async function saveSeries(series: DocumentSeries) {
    await api.put(`/document-series/${series.code}`, {
      name: series.name,
      scope: series.scope,
      prefix: series.prefix ?? undefined,
      year: series.year ?? null,
      nextNumber: series.nextNumber,
      padding: series.padding,
      active: series.active,
    });
    await loadSeries();
  }

  async function deleteSeries(code: string) {
    const ok = window.confirm(`Eliminar serie ${code}?`);
    if (!ok) return;
    await api.del(`/document-series/${code}`);
    await loadSeries();
  }

  return (
    <div className="stack">
      <h2>Pedidos</h2>
      <div className="card stack">
        <div className="row row-space orders-actions-row">
          <strong>Pedidos (ventas)</strong>
          <button className="secondary" type="button" onClick={openSeriesModal}>
            Series
          </button>
        </div>
        <div className="row row-space orders-actions-row">
          <div className="row orders-actions-row">
            <button
              className="secondary"
              type="button"
              onClick={() => refreshPosOrders().catch((err) => setStatus(err.message))}
            >
              Refrescar
            </button>
            <button
              className="secondary"
              type="button"
              onClick={resetPosFilters}
              disabled={!filtersActive}
            >
              Limpiar filtros
            </button>
          </div>
          {filtersActive && <span className="muted">Filtros activos</span>}
        </div>
        <div className="row bulk-actions orders-actions-row">
          <button
            className="secondary"
            type="button"
            onClick={toggleAllPosOrders}
            disabled={posOrders.length === 0}
          >
            {allPosSelected ? "Quitar seleccion" : "Seleccionar todo"}
          </button>
          <span className="muted">{selectedPosOrders.size} seleccionados</span>
          <button
            className="delete-button"
            type="button"
            disabled={selectedPosOrders.size === 0}
            onClick={deleteSelectedPosOrders}
          >
            Eliminar
          </button>
        </div>
        <div className="row orders-filters-mobilebar">
          <label className="stack" style={{ flex: 1 }}>
            <span className="muted">Buscar</span>
            <input
              className="input"
              value={posQuery}
              onChange={(e) => {
                setPosQuery(e.target.value);
                setPosPage(1);
              }}
              placeholder="Referencia o cliente"
            />
          </label>
          <button
            className="secondary"
            type="button"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filtros
          </button>
        </div>
        <div
          className={`row wrap orders-filters${
            showFilters ? " orders-filters-open" : ""
          }`}
        >
          <label className="stack">
            <span className="muted">Buscar</span>
            <input
              className="input"
              value={posQuery}
              onChange={(e) => {
                setPosQuery(e.target.value);
                setPosPage(1);
              }}
              placeholder="Referencia o cliente"
            />
          </label>
          <label className="stack">
            <span className="muted">Tipo</span>
            <select
              className="input"
              value={posType}
              onChange={(e) => {
                setPosType(e.target.value);
                setPosPage(1);
              }}
            >
              <option value="">Todos</option>
              <option value="b2c_sale">Venta B2C</option>
              <option value="b2b_sale">Venta B2B</option>
              <option value="b2c_return">Devolucion B2C</option>
              <option value="b2b_return">Devolucion B2B</option>
              <option value="transfer">Traspaso/Deposito</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Serie</span>
            <input
              className="input"
              value={posSeries}
              onChange={(e) => {
                setPosSeries(e.target.value);
                setPosPage(1);
              }}
              placeholder="B2C, B2B, DEV, DEP"
            />
          </label>
          <label className="stack">
            <span className="muted">Desde</span>
            <input
              className="input"
              type="date"
              value={posFrom}
              onChange={(e) => {
                setPosFrom(e.target.value);
                setPosPage(1);
              }}
            />
          </label>
          <label className="stack">
            <span className="muted">Hasta</span>
            <input
              className="input"
              type="date"
              value={posTo}
              onChange={(e) => {
                setPosTo(e.target.value);
                setPosPage(1);
              }}
            />
          </label>
          <label className="stack">
            <span className="muted">Pagina</span>
            <select
              className="input"
              value={posPageSize}
              onChange={(e) => {
                setPosPageSize(Number(e.target.value));
                setPosPage(1);
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Serie</th>
              <th>Comprador</th>
              <th>Unidades</th>
              <th>Pago</th>
              <th>Total</th>
              <th>Fecha</th>
              <th>Informe</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {posOrders.map((m) => (
              <tr key={m.id}>
                <td className="center-cell">
                  <input
                    type="checkbox"
                    checked={selectedPosOrders.has(m.id)}
                    onChange={() => togglePosOrder(m.id)}
                  />
                </td>
                <td>{m.id}</td>
                <td>{m.type}</td>
                <td>{m.reference ?? "-"}</td>
                <td>{m.seriesCode ?? "-"}</td>
                <td>{m.buyer ?? "-"}</td>
                <td>{m.units ?? 0}</td>
                <td>
                  {m.paymentStatus === "paid" && <span>Pagado</span>}
                  {m.paymentStatus === "partial" && (
                    <span>
                      Parcial ({(m.paidAmount ?? 0).toFixed(2)})
                    </span>
                  )}
                  {!m.paymentStatus ||
                    (m.paymentStatus === "pending" && <span>Pendiente</span>)}
                </td>
                <td>{m.total?.toFixed(2) ?? "-"}</td>
                <td>{new Date(m.date).toLocaleString()}</td>
                <td>
                  <div className="row">
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => downloadReport(m.id, "ticket")}
                    >
                      Ticket
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      onClick={() => downloadReport(m.id, "invoice")}
                    >
                      Factura
                    </button>
                  </div>
                </td>
                <td className="center-cell">
                  <button className="secondary" onClick={() => openMove(m.id)}>
                    Ver pedido
                  </button>
                </td>
                <td className="center-cell">
                  <span
                    className={`payment-dot payment-dot-${
                      m.paymentStatus === "paid"
                        ? "paid"
                        : m.paymentStatus === "partial"
                          ? "partial"
                          : "pending"
                    }`}
                    title={
                      m.paymentStatus === "paid"
                        ? "Pagado"
                        : m.paymentStatus === "partial"
                          ? "Parcial"
                          : "Pendiente"
                    }
                  />
                </td>
              </tr>
            ))}
            {posOrders.length === 0 && (
              <tr>
                <td colSpan={13} className="muted">
                  Sin pedidos
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="row row-space orders-pagination-row">
          <span className="muted">
            Total: {posTotal} pedidos
          </span>
          <div className="row orders-pagination-controls">
            <button
              className="secondary"
              type="button"
              onClick={() => setPosPage((p) => Math.max(1, p - 1))}
              disabled={posPage === 1}
            >
              Anterior
            </button>
            <span className="muted">
              Pagina {posPage} de{" "}
              {Math.max(1, Math.ceil(posTotal / posPageSize))}
            </span>
            <button
              className="secondary"
              type="button"
              onClick={() =>
                setPosPage((p) =>
                  p < Math.ceil(posTotal / posPageSize) ? p + 1 : p,
                )
              }
              disabled={posPage >= Math.ceil(posTotal / posPageSize)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <strong>Depositos</strong>
          <button
            className="secondary"
            onClick={() => loadDepositCustomers().catch((err) => setStatus(err.message))}
          >
            Refrescar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Unidades</th>
              <th>Coste</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {depositCustomers.map((customer) => (
              <tr key={customer.customerId}>
                <td>{customer.name}</td>
                <td>{customer.units}</td>
                <td>{customer.cost.toFixed(2)}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() =>
                      loadDepositDetail(customer.customerId).catch((err) =>
                        setStatus(err.message),
                      )
                    }
                  >
                    Ver deposito
                  </button>
                </td>
              </tr>
            ))}
            {depositCustomers.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin depositos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {depositDetail && (
        <div className="card stack">
          <div className="row">
            <div className="stack">
              <strong>{depositDetail.customer.name}</strong>
              <span className="muted">Cliente</span>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Stock</th>
                <th>Cantidad venta</th>
                <th>Precio venta</th>
                <th>Devolver</th>
              </tr>
            </thead>
            <tbody>
              {depositDetail.items.map((item) => (
                <tr key={item.sku}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.quantity}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={depositSaleQty[item.sku] ?? 0}
                      onChange={(e) =>
                        setDepositSaleQty((prev) => ({
                          ...prev,
                          [item.sku]: Number(e.target.value),
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={depositSaleLines[item.sku] ?? 0}
                      onChange={(e) =>
                        setDepositSaleLines((prev) => ({
                          ...prev,
                          [item.sku]: Number(e.target.value),
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={depositReturnLines[item.sku] ?? 0}
                      onChange={(e) =>
                        setDepositReturnLines((prev) => ({
                          ...prev,
                          [item.sku]: Number(e.target.value),
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
              {depositDetail.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin stock en deposito
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="row center-actions">
            <label className="stack">
              <span className="muted">Almacen destino</span>
              <select
                className="input"
                value={depositWarehouseId ?? ""}
                onChange={(e) => setDepositWarehouseId(Number(e.target.value))}
              >
                {depositWarehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={() => convertDeposit().catch((err) => setStatus(err.message))}>
              Convertir a venta
            </button>
            <button
              className="secondary"
              onClick={() => returnDeposit().catch((err) => setStatus(err.message))}
            >
              Devolver a almacen
            </button>
          </div>
        </div>
      )}
      {selectedMove && (
        <div className="modal-backdrop" onClick={() => setSelectedMove(null)}>
          <div
            className="card modal-card stack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row row-space">
              <strong>
                Pedido {selectedMove.reference ?? `#${selectedMove.id}`}
              </strong>
              <button
                className="secondary"
                type="button"
                onClick={() => setSelectedMove(null)}
              >
                Cerrar
              </button>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Numero</span>
                <input
                  className="input"
                  value={editReference}
                  onChange={(e) => setEditReference(e.target.value)}
                />
              </label>
              <label className="stack">
                <span className="muted">Fecha</span>
                <input
                  className="input"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </label>
              <label className="stack">
                <span className="muted">Notas</span>
                <input
                  className="input"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </label>
              <label className="stack">
                <span className="muted">Pago</span>
                <select
                  className="input"
                  value={editPaymentStatus}
                  onChange={(e) =>
                    {
                      const next = e.target.value as
                        | "pending"
                        | "partial"
                        | "paid";
                      setEditPaymentStatus(next);
                      if (next !== "partial") {
                        setEditPaidAmount("");
                        return;
                      }
                      const total = getMoveTotal(selectedMove);
                      const paid = Number(editPaidAmount);
                      if (
                        !editPaidAmount ||
                        Number.isNaN(paid) ||
                        paid <= 0 ||
                        paid >= total
                      ) {
                        setEditPaidAmount("");
                      }
                    }
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="partial">Parcial</option>
                  <option value="paid">Pagado</option>
                </select>
              </label>
              {editPaymentStatus === "partial" && (
                <label className="stack">
                  <span className="muted">Pagado</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPaidAmount}
                    onChange={(e) => setEditPaidAmount(e.target.value)}
                  />
                </label>
              )}
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nombre</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedMove.lines?.map((line: any, index: number) => (
                  <tr key={`${line.sku}-${index}`}>
                    <td>{line.sku}</td>
                    <td>{line.product?.name ?? "-"}</td>
                    <td>{line.quantity}</td>
                    <td>{line.unitPrice ?? "-"}</td>
                    <td>
                      {(
                        (line.unitPrice ? Number(line.unitPrice) : 0) *
                        line.quantity
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))}
                {!selectedMove.lines?.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Sin lineas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row center-actions">
              <button onClick={saveMove}>Guardar cambios</button>
            </div>
          </div>
        </div>
      )}
      {seriesModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setSeriesModalOpen(false)}
        >
          <div className="card modal-card stack" onClick={(e) => e.stopPropagation()}>
            <div className="row row-space">
              <strong>Series</strong>
              <button
                className="secondary"
                type="button"
                onClick={() => setSeriesModalOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="card stack">
              <strong>Nueva serie</strong>
              <div className="row wrap">
                <label className="field small">
                  <span className="muted">Codigo</span>
                  <input
                    className="input"
                    value={newSeries.code ?? ""}
                    onChange={(e) =>
                      setNewSeries((prev) => ({ ...prev, code: e.target.value }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Nombre</span>
                  <input
                    className="input"
                    value={newSeries.name ?? ""}
                    onChange={(e) =>
                      setNewSeries((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Scope</span>
                  <select
                    className="input"
                    value={newSeries.scope ?? ""}
                    onChange={(e) =>
                      setNewSeries((prev) => ({ ...prev, scope: e.target.value }))
                    }
                  >
                    <option value="">Selecciona</option>
                    {SERIES_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field small">
                  <span className="muted">Prefijo</span>
                  <input
                    className="input"
                    value={newSeries.prefix ?? ""}
                    onChange={(e) =>
                      setNewSeries((prev) => ({ ...prev, prefix: e.target.value }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Año</span>
                  <input
                    className="input"
                    type="number"
                    value={newSeries.year ?? ""}
                    onChange={(e) =>
                      setNewSeries((prev) => ({
                        ...prev,
                        year: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Siguiente</span>
                  <input
                    className="input"
                    type="number"
                    value={newSeries.nextNumber ?? 1}
                    onChange={(e) =>
                      setNewSeries((prev) => ({
                        ...prev,
                        nextNumber: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Padding</span>
                  <input
                    className="input"
                    type="number"
                    value={newSeries.padding ?? 6}
                    onChange={(e) =>
                      setNewSeries((prev) => ({
                        ...prev,
                        padding: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="field small">
                  <span className="muted">Activa</span>
                  <select
                    className="input"
                    value={(newSeries.active ?? true) ? "1" : "0"}
                    onChange={(e) =>
                      setNewSeries((prev) => ({
                        ...prev,
                        active: e.target.value === "1",
                      }))
                    }
                  >
                    <option value="1">Si</option>
                    <option value="0">No</option>
                  </select>
                </label>
                <button type="button" onClick={createSeries}>
                  Crear
                </button>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Scope</th>
                  <th>Prefijo</th>
                  <th>Año</th>
                  <th>Siguiente</th>
                  <th>Padding</th>
                  <th>Activa</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {seriesList.map((series) => (
                  <tr key={series.code}>
                    <td>{series.code}</td>
                    <td>
                      <input
                        className="input"
                        value={series.name}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, name: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="input"
                        value={series.scope}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, scope: e.target.value }
                                : item,
                            ),
                          )
                        }
                      >
                        {SERIES_SCOPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        value={series.prefix ?? ""}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, prefix: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={series.year ?? ""}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? {
                                    ...item,
                                    year: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={series.nextNumber}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, nextNumber: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        value={series.padding}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, padding: Number(e.target.value) }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={series.active ? "1" : "0"}
                        onChange={(e) =>
                          setSeriesList((prev) =>
                            prev.map((item) =>
                              item.code === series.code
                                ? { ...item, active: e.target.value === "1" }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="1">Si</option>
                        <option value="0">No</option>
                      </select>
                    </td>
                    <td className="center-cell">
                      <button
                        className="secondary"
                        onClick={() => saveSeries(series)}
                      >
                        Guardar
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => deleteSeries(series.code)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {seriesList.length === 0 && (
                  <tr>
                    <td colSpan={9} className="muted">
                      Sin series
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
