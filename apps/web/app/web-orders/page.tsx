"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type WebOrder = {
  wooOrderId: string;
  number: string;
  status: string;
  createdAtWoo: string;
  customerName: string;
  email: string;
  total: string;
  currency: string;
  assignedWarehouseId?: number | null;
  processedAt?: string | null;
  customerId?: number | null;
  hasMove?: boolean;
  lines?: {
    id: number;
    sku: string;
    qty: number;
    price: number;
    lineTotal: number;
    product?: { name?: string };
  }[];
  assignedWarehouse?: { id: number; name: string } | null;
  customer?: { id: number; name: string } | null;
};

type Location = { id: number; name: string; type: "warehouse" | "retail" };
type Accessory = { id: number; name: string; cost: number | null };

export default function WebOrdersPage() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<WebOrder | null>(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [processedPage, setProcessedPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);
  const [processedPageSize, setProcessedPageSize] = useState(10);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<
    Record<number, number>
  >({});

  async function loadOrders() {
    setStatus(null);
    const data = await api.get<WebOrder[]>("/web-orders");
    setOrders(data);
    setPendingPage(1);
    setProcessedPage(1);
  }

  useEffect(() => {
    api
      .get<Location[]>("/locations?type=warehouse")
      .then(setWarehouses)
      .catch((err) => setStatus(err.message));
    api
      .get<Accessory[]>("/accessories")
      .then(setAccessories)
      .catch((err) => setStatus(err.message));
    loadOrders().catch((err) => setStatus(err.message));
  }, []);

  const pending = useMemo(
    () => orders.filter((o) => !o.processedAt || o.hasMove === false),
    [orders],
  );
  const processed = useMemo(
    () => orders.filter((o) => o.processedAt && o.hasMove !== false),
    [orders],
  );

  function getWebReference(order: WebOrder) {
    const year = new Date(order.createdAtWoo).getFullYear();
    return `WEB-${year}-${order.number}`;
  }

  const pendingTotalPages = Math.max(
    1,
    Math.ceil(pending.length / pendingPageSize),
  );
  const processedTotalPages = Math.max(
    1,
    Math.ceil(processed.length / processedPageSize),
  );
  const pendingPageItems = pending.slice(
    (pendingPage - 1) * pendingPageSize,
    pendingPage * pendingPageSize,
  );
  const processedPageItems = processed.slice(
    (processedPage - 1) * processedPageSize,
    processedPage * processedPageSize,
  );

  async function importWoo() {
    setStatus(null);
    await api.post("/woo/import", {});
    await loadOrders();
  }

  async function reconcile() {
    setStatus(null);
    const res = await api.post<{
      total: number;
      created: number;
      skipped: number;
      errors: { wooOrderId: string; error: string }[];
    }>("/web-orders/reconcile", {});
    await loadOrders();
    if (res.errors?.length) {
      setStatus(
        `Reconciliados ${res.created}/${res.total}. Errores: ${res.errors.length}`,
      );
    } else {
      setStatus(`Reconciliados ${res.created}/${res.total}.`);
    }
  }

  async function assign(wooOrderId: string, warehouseId: number) {
    setStatus(null);
    if (!warehouseId || Number.isNaN(warehouseId)) {
      setStatus("Selecciona un almacen valido");
      return;
    }
    await api.post(`/web-orders/${wooOrderId}/assign-warehouse`, {
      warehouseId,
    });
    await loadOrders();
    if (selectedOrder?.wooOrderId === wooOrderId) {
      await openOrder(wooOrderId);
    }
  }

  async function process(wooOrderId: string) {
    setStatus(null);
    try {
      const addOns = Object.entries(selectedAddOns)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          accessoryId: Number(id),
          quantity: qty,
        }));
      await api.post(`/web-orders/${wooOrderId}/process`, { addOns });
      await loadOrders();
      setSelectedOrder(null);
      setStatus("Pedido procesado");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(message);
      await openOrder(wooOrderId);
    }
  }


  async function openOrder(wooOrderId: string) {
    setStatus(null);
    const data = await api.get<WebOrder>(`/web-orders/${wooOrderId}`);
    setSelectedOrder(data);
    setSelectedAddOns({});
  }

  function toggleAddOn(id: number, checked: boolean) {
    setSelectedAddOns((prev) => {
      if (!checked) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: prev[id] ?? 1 };
    });
  }

  function updateAddOnQty(id: number, qty: number) {
    setSelectedAddOns((prev) => ({ ...prev, [id]: Math.max(1, qty) }));
  }

  return (
    <div className="stack">
      <h2>Pedidos web</h2>
      <div className="card stack">
        <button onClick={() => setShowActions((prev) => !prev)}>
          {showActions ? "Ocultar acciones" : "Acciones"}
        </button>
        {showActions && (
          <div className="row">
            <button onClick={importWoo}>Importar Woo</button>
            <button className="secondary" onClick={reconcile}>
              Reconciliar procesados
            </button>
            <button className="secondary" onClick={loadOrders}>
              Refrescar
            </button>
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row row-space">
          <strong>Pendientes de procesar</strong>
          <label className="stack">
            <span className="muted">Pagina</span>
            <select
              className="input"
              value={pendingPageSize}
              onChange={(e) => {
                setPendingPageSize(Number(e.target.value));
                setPendingPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Almacen</th>
              <th></th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
              {pendingPageItems.map((o) => (
                <tr key={o.wooOrderId} onClick={() => openOrder(o.wooOrderId)}>
                <td>{getWebReference(o)}</td>
                <td>Pendiente</td>
                <td>{o.customerName}</td>
                <td>
                  {o.total} {o.currency}
                </td>
                <td>
                  <select
                    value={o.assignedWarehouseId ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      assign(o.wooOrderId, Number(e.target.value));
                    }}
                  >
                    <option value="">Sin asignar</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {(!o.processedAt || o.hasMove === false) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatus("Selecciona almacen y accesorios");
                        openOrder(o.wooOrderId);
                      }}
                    >
                      Procesar
                    </button>
                  )}
                </td>
                <td></td>
                <td>
                  <button
                    className="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrder(o.wooOrderId);
                    }}
                  >
                    Ver pedido
                  </button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={8} className="muted">
                  No hay pedidos pendientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {pending.length > 0 && (
          <div className="row row-space orders-pagination-row">
            <span className="muted">
              Pag {pendingPage} de {pendingTotalPages}
            </span>
            <div className="row orders-pagination-controls">
              <button
                className="secondary"
                type="button"
                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                disabled={pendingPage === 1}
              >
                Anterior
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setPendingPage((p) => (p < pendingTotalPages ? p + 1 : p))
                }
                disabled={pendingPage >= pendingTotalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="row row-space">
          <strong>Procesados</strong>
          <label className="stack">
            <span className="muted">Pagina</span>
            <select
              className="input"
              value={processedPageSize}
              onChange={(e) => {
                setProcessedPageSize(Number(e.target.value));
                setProcessedPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
            </select>
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Estado</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Procesado</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processedPageItems.map((o) => (
              <tr key={o.wooOrderId} onClick={() => openOrder(o.wooOrderId)}>
                <td>{getWebReference(o)}</td>
                <td>
                  {o.status === "completed" ? "Completado" : "Procesado"}
                  {o.hasMove === false && (
                    <span className="pill pill-warn">Sin venta</span>
                  )}
                </td>
                <td>{o.customerName}</td>
                <td>
                  {o.total} {o.currency}
                </td>
                <td>
                  {o.processedAt
                    ? new Date(o.processedAt).toLocaleString()
                    : "-"}
                </td>
                <td>
                  {o.hasMove === false && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatus("Selecciona almacen y accesorios");
                        openOrder(o.wooOrderId);
                      }}
                    >
                      Procesar
                    </button>
                  )}
                </td>
                <td>
                  <button
                    className="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrder(o.wooOrderId);
                    }}
                  >
                    Ver pedido
                  </button>
                </td>
              </tr>
            ))}
            {processed.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No hay pedidos procesados
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {processed.length > 0 && (
          <div className="row row-space orders-pagination-row">
            <span className="muted">
              Pag {processedPage} de {processedTotalPages}
            </span>
            <div className="row orders-pagination-controls">
              <button
                className="secondary"
                type="button"
                onClick={() => setProcessedPage((p) => Math.max(1, p - 1))}
                disabled={processedPage === 1}
              >
                Anterior
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setProcessedPage((p) =>
                    p < processedTotalPages ? p + 1 : p,
                  )
                }
                disabled={processedPage >= processedTotalPages}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div
            className="card modal-card stack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row row-space">
              <strong>Pedido web {selectedOrder.number}</strong>
              <button className="secondary" onClick={() => setSelectedOrder(null)}>
                Cerrar
              </button>
            </div>
            <div className="row row-space">
              <label className="stack">
                <span className="muted">Almacen</span>
                <select
                  className="input"
                  value={selectedOrder.assignedWarehouseId ?? ""}
                  onChange={(e) =>
                    assign(selectedOrder.wooOrderId, Number(e.target.value))
                  }
                >
                  <option value="">Sin asignar</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row">
                {(!selectedOrder.processedAt ||
                  selectedOrder.hasMove === false) && (
                  <button
                    onClick={() => {
                      if (!selectedOrder.assignedWarehouseId) {
                        setStatus("Selecciona un almacen para procesar");
                        return;
                      }
                      process(selectedOrder.wooOrderId);
                    }}
                  >
                    Procesar
                  </button>
                )}
              </div>
            </div>
            <div className="card stack">
              <strong>Accesorios (solo coste)</strong>
              <div className="stack">
                {accessories.map((acc) => {
                  const checked = selectedAddOns[acc.id] != null;
                  return (
                    <div key={acc.id} className="row row-space">
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleAddOn(acc.id, e.target.checked)}
                        />
                        <span>{acc.name}</span>
                      </label>
                      <div className="row">
                        <span className="muted">
                          Coste {Number(acc.cost ?? 0).toFixed(2)}
                        </span>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          value={checked ? selectedAddOns[acc.id] : 1}
                          onChange={(e) =>
                            updateAddOnQty(acc.id, Number(e.target.value))
                          }
                          disabled={!checked}
                        />
                      </div>
                    </div>
                  );
                })}
                {accessories.length === 0 && (
                  <span className="muted">No hay accesorios activos.</span>
                )}
              </div>
            </div>
            <div className="row wrap">
              <div className="stack">
                <span className="muted">Cliente</span>
                <span>{selectedOrder.customerName}</span>
              </div>
              {selectedOrder.customerId && (
                <div className="stack">
                  <span className="muted">Cliente ERP</span>
                  <a
                    className="secondary"
                    href={`/crm/customers/${selectedOrder.customerId}`}
                  >
                    Ver cliente
                  </a>
                </div>
              )}
              <div className="stack">
                <span className="muted">Email</span>
                <span>{selectedOrder.email}</span>
              </div>
              <div className="stack">
                <span className="muted">Estado</span>
                <span>
                  {selectedOrder.status}
                  {selectedOrder.hasMove === false && (
                    <span className="pill pill-warn">Sin venta</span>
                  )}
                </span>
              </div>
              <div className="stack">
                <span className="muted">Fecha</span>
                <span>{new Date(selectedOrder.createdAtWoo).toLocaleString()}</span>
              </div>
              <div className="stack">
                <span className="muted">Total</span>
                <span>
                  {selectedOrder.total} {selectedOrder.currency}
                </span>
              </div>
              <div className="stack">
                <span className="muted">Almacen</span>
                <span>
                  {selectedOrder.assignedWarehouse?.name ?? "Sin asignar"}
                </span>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.lines?.map((line) => (
                  <tr key={line.id}>
                    <td>{line.sku}</td>
                    <td>{line.product?.name ?? "-"}</td>
                    <td>{line.qty}</td>
                    <td>{Number(line.price).toFixed(2)}</td>
                    <td>{Number(line.lineTotal).toFixed(2)}</td>
                  </tr>
                ))}
                {!selectedOrder.lines?.length && (
                  <tr>
                    <td colSpan={5} className="muted">
                      Sin lineas
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
