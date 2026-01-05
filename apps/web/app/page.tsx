"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api";

type DashboardData = {
  kpis: {
    productsActive: number;
    pendingOrders: number;
    salesToday: number;
    salesMonth: number;
    returnsMonth: number;
    netSalesMonth: number;
    salesMonthCount: number;
    avgTicketMonth: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  topLowStock: {
    sku: string;
    name: string;
    stock: number;
    soldRecent: number;
    suggestedQty: number;
  }[];
  recentMoves: {
    id: number;
    type: string;
    reference: string | null;
    date: string;
    fromId: number | null;
    toId: number | null;
  }[];
  recentOrders: {
    wooOrderId: string;
    number: string;
    status: string;
    createdAtWoo: string;
  }[];
};

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function formatMoney(value?: number) {
    if (typeof value !== "number") return "-";
    return `${value.toFixed(2)} EUR`;
  }

  useEffect(() => {
    api
      .get<DashboardData>("/dashboard")
      .then(setData)
      .catch((err) => setStatus(err.message));
  }, []);

  return (
    <div className="stack">
      <h2>Dashboard</h2>
      <p className="muted">Resumen rapido del sistema.</p>

      <div className="kpi-grid">
        <div className="card highlight">
          <div className="muted">Productos activos</div>
          <div className="kpi-value">{data?.kpis.productsActive ?? "-"}</div>
        </div>
        <div className="card highlight">
          <div className="muted">Ventas hoy</div>
          <div className="kpi-value">
            {data ? formatMoney(data.kpis.salesToday) : "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Ventas mes</div>
          <div className="kpi-value">
            {data ? formatMoney(data.kpis.salesMonth) : "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Devoluciones mes</div>
          <div className="kpi-value">
            {data ? formatMoney(data.kpis.returnsMonth) : "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Neto mes</div>
          <div className="kpi-value">
            {data ? formatMoney(data.kpis.netSalesMonth) : "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Ticket medio</div>
          <div className="kpi-value">
            {data ? formatMoney(data.kpis.avgTicketMonth) : "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Ventas mes (num)</div>
          <div className="kpi-value">
            {data?.kpis.salesMonthCount ?? "-"}
          </div>
        </div>
        <div className="card highlight">
          <div className="muted">Stock bajo</div>
          <div className="kpi-value">{data?.kpis.lowStockCount ?? "-"}</div>
        </div>
        <div className="card highlight">
          <div className="muted">Sin stock</div>
          <div className="kpi-value">{data?.kpis.outOfStockCount ?? "-"}</div>
        </div>
        <div className="card highlight">
          <div className="muted">Pedidos web</div>
          <div className="kpi-value">{data?.kpis.pendingOrders ?? "-"}</div>
        </div>
      </div>

      <div className="card stack">
        <strong>Sugerencias de compra</strong>
        <p className="muted">
          Productos con stock bajo y ventas recientes (ultimos 30 dias).
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Stock</th>
              <th>Ventas</th>
              <th>Recomendado</th>
            </tr>
          </thead>
          <tbody>
            {(data?.topLowStock ?? []).map((row) => (
              <tr key={row.sku}>
                <td>{row.sku}</td>
                <td>{row.name}</td>
                <td>{row.stock}</td>
                <td>{row.soldRecent}</td>
                <td>{row.suggestedQty}</td>
              </tr>
            ))}
            {data && data.topLowStock.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin sugerencias
                </td>
              </tr>
            )}
            {!data && !status && (
              <tr>
                <td colSpan={5} className="muted">
                  Cargando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <strong>Actividad reciente</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Detalle</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {(data?.recentOrders ?? []).map((order) => (
              <tr key={`order-${order.wooOrderId}`}>
                <td>Web order</td>
                <td>#{order.number}</td>
                <td>{order.status}</td>
                <td>{new Date(order.createdAtWoo).toLocaleString()}</td>
              </tr>
            ))}
            {(data?.recentMoves ?? []).map((move) => (
              <tr key={`move-${move.id}`}>
                <td>{move.type}</td>
                <td>{move.reference ?? `#${move.id}`}</td>
                <td>
                  {move.fromId ? `from ${move.fromId}` : ""}
                  {move.toId ? ` to ${move.toId}` : ""}
                </td>
                <td>{new Date(move.date).toLocaleString()}</td>
              </tr>
            ))}
            {!data && !status && (
              <tr>
                <td colSpan={4} className="muted">
                  Cargando...
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {status && <p className="muted">{status}</p>}
      </div>
    </div>
  );
}
