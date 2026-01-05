"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type RowCategory = {
  categoryId: number;
  categoryName: string;
  quantity: number;
  total: number;
};

type RowSku = {
  sku: string;
  name: string | null;
  quantity: number;
  total: number;
};

type RowMonth = {
  month: string;
  quantity: number;
  total: number;
};

type PurchaseSuggestion = {
  sku: string;
  name: string;
  stock: number;
  soldRecent: number;
  suggestedQty: number;
};

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [channel, setChannel] = useState<"" | "B2B" | "B2C">("");
  const [byCategory, setByCategory] = useState<RowCategory[]>([]);
  const [bySku, setBySku] = useState<RowSku[]>([]);
  const [byMonth, setByMonth] = useState<RowMonth[]>([]);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [minStock, setMinStock] = useState("3");
  const [days, setDays] = useState("30");
  const [limit, setLimit] = useState("50");
  const [status, setStatus] = useState<string | null>(null);

  function buildQuery() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (channel) params.set("channel", channel);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadAll() {
    setStatus(null);
    const qs = buildQuery();
    const [cat, sku, month] = await Promise.all([
      api.get<RowCategory[]>(`/reports/sales-by-category${qs}`),
      api.get<RowSku[]>(`/reports/sales-by-sku${qs}`),
      api.get<RowMonth[]>(`/reports/sales-by-month${qs}`),
    ]);
    setByCategory(cat);
    setBySku(sku);
    setByMonth(month);
  }

  async function loadSuggestions() {
    setStatus(null);
    const params = new URLSearchParams();
    if (minStock) params.set("minStock", minStock);
    if (days) params.set("days", days);
    if (limit) params.set("limit", limit);
    const qs = params.toString();
    const data = await api.get<PurchaseSuggestion[]>(
      `/suggestions/purchases${qs ? `?${qs}` : ""}`,
    );
    setSuggestions(data);
  }

  useEffect(() => {
    loadAll().catch((err) => setStatus(err.message));
    loadSuggestions().catch((err) => setStatus(err.message));
  }, []);

  return (
    <div className="stack">
      <h2>Informes</h2>
      <div className="card stack">
        <strong>Filtros</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Desde</span>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Hasta</span>
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Canal</span>
            <select
              className="input"
              value={channel}
              onChange={(e) => setChannel(e.target.value as "" | "B2B" | "B2C")}
            >
              <option value="">Todos</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Accion</span>
            <button onClick={() => loadAll().catch((err) => setStatus(err.message))}>
              Actualizar
            </button>
          </label>
        </div>
      </div>

      <div className="card stack">
        <strong>Ventas por categoria</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Unidades</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((row) => (
              <tr key={row.categoryId}>
                <td>{row.categoryName}</td>
                <td>{row.quantity}</td>
                <td>{row.total.toFixed(2)}</td>
              </tr>
            ))}
            {byCategory.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <strong>Ventas por SKU</strong>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Unidades</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {bySku.map((row) => (
              <tr key={row.sku}>
                <td>{row.sku}</td>
                <td>{row.name ?? "-"}</td>
                <td>{row.quantity}</td>
                <td>{row.total.toFixed(2)}</td>
              </tr>
            ))}
            {bySku.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <strong>Ventas por mes</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Unidades</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map((row) => (
              <tr key={row.month}>
                <td>{row.month}</td>
                <td>{row.quantity}</td>
                <td>{row.total.toFixed(2)}</td>
              </tr>
            ))}
            {byMonth.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <strong>Sugerencias de compra</strong>
        <p className="muted">
          Productos con stock bajo y ventas recientes. Usa estos filtros para
          ajustar la recomendacion.
        </p>
        <div className="row">
          <label className="stack">
            <span className="muted">Stock minimo</span>
            <input
              className="input"
              type="number"
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Dias ventas</span>
            <input
              className="input"
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Max resultados</span>
            <input
              className="input"
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Accion</span>
            <button
              onClick={() =>
                loadSuggestions().catch((err) => setStatus(err.message))
              }
            >
              Actualizar
            </button>
          </label>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Stock</th>
              <th>Ventas recientes</th>
              <th>Recomendado</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((row) => (
              <tr key={row.sku}>
                <td>{row.sku}</td>
                <td>{row.name}</td>
                <td>{row.stock}</td>
                <td>{row.soldRecent}</td>
                <td>{row.suggestedQty}</td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin sugerencias
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
