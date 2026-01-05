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
};

type Location = { id: number; name: string; type: "warehouse" | "retail" };

export default function WebOrdersPage() {
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
  const [showActions, setShowActions] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function loadOrders() {
    setStatus(null);
    const data = await api.get<WebOrder[]>("/web-orders");
    setOrders(data);
  }

  useEffect(() => {
    api
      .get<Location[]>("/locations?type=warehouse")
      .then(setWarehouses)
      .catch((err) => setStatus(err.message));
    loadOrders().catch((err) => setStatus(err.message));
  }, []);

  const pending = useMemo(
    () => orders.filter((o) => !o.processedAt),
    [orders],
  );

  async function importWoo() {
    setStatus(null);
    await api.post("/woo/import", {});
    await loadOrders();
  }

  async function assign(wooOrderId: string, warehouseId: number) {
    setStatus(null);
    await api.post(`/web-orders/${wooOrderId}/assign-warehouse`, {
      warehouseId,
    });
    await loadOrders();
  }

  async function process(wooOrderId: string) {
    setStatus(null);
    await api.post(`/web-orders/${wooOrderId}/process`);
    await loadOrders();
  }

  async function markCompleted(wooOrderId: string) {
    setStatus(null);
    await api.post(`/web-orders/${wooOrderId}/mark-completed`);
    await loadOrders();
  }

  return (
    <div className="stack">
      <h2>Web Orders</h2>
      <div className="card stack">
        <button onClick={() => setShowActions((prev) => !prev)}>
          {showActions ? "Ocultar acciones" : "Acciones"}
        </button>
        {showActions && (
          <div className="row">
            <button onClick={importWoo}>Importar Woo</button>
            <button className="secondary" onClick={loadOrders}>
              Refrescar
            </button>
          </div>
        )}
      </div>

      <div className="card stack">
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
              </tr>
            </thead>
            <tbody>
              {pending.map((o) => (
                <tr key={o.wooOrderId}>
                <td>{o.number}</td>
                <td>{o.status}</td>
                <td>{o.customerName}</td>
                <td>
                  {o.total} {o.currency}
                </td>
                <td>
                  <select
                    value={o.assignedWarehouseId ?? ""}
                    onChange={(e) =>
                      assign(o.wooOrderId, Number(e.target.value))
                    }
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
                  <button onClick={() => process(o.wooOrderId)}>
                    Procesar
                  </button>
                </td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => markCompleted(o.wooOrderId)}
                  >
                    Marcar completado
                  </button>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No hay pedidos pendientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
