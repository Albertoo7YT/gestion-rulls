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

type SummaryRow = {
  units: number;
  revenue: number;
  revenuePaid: number;
  revenuePending: number;
  cost: number;
  margin: number;
  orders: number;
  returnsUnits: number;
  returnsRevenue: number;
  returnsCost: number;
};

type DepositSummary = {
  pendingUnits: number;
  pendingCost: number;
  convertedUnits: number;
  convertedRevenue: number;
  returnedUnits: number;
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
  const [channel, setChannel] = useState<"" | "B2B" | "B2C" | "WEB">("");
  const [seriesScope, setSeriesScope] = useState("");
  const [seriesCode, setSeriesCode] = useState("");
  const [byCategory, setByCategory] = useState<RowCategory[]>([]);
  const [bySku, setBySku] = useState<RowSku[]>([]);
  const [byMonth, setByMonth] = useState<RowMonth[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [deposits, setDeposits] = useState<DepositSummary | null>(null);
  const [suggestions, setSuggestions] = useState<PurchaseSuggestion[]>([]);
  const [reportType, setReportType] = useState<"sku" | "category" | "month">(
    "sku",
  );
  const [skuSearch, setSkuSearch] = useState("");
  const [skuPage, setSkuPage] = useState(1);
  const [skuPageSize, setSkuPageSize] = useState(25);
  const [minStock, setMinStock] = useState("3");
  const [days, setDays] = useState("30");
  const [limit, setLimit] = useState("50");
  const [status, setStatus] = useState<string | null>(null);

  function buildQuery() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (channel) params.set("channel", channel);
    if (seriesScope) params.set("seriesScope", seriesScope);
    if (seriesCode) params.set("seriesCode", seriesCode);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async function loadAll() {
    setStatus(null);
    const qs = buildQuery();
    const [summaryRow, cat, sku, month, depositSummary] = await Promise.all([
      api.get<SummaryRow>(`/reports/summary${qs}`),
      api.get<RowCategory[]>(`/reports/sales-by-category${qs}`),
      api.get<RowSku[]>(`/reports/sales-by-sku${qs}`),
      api.get<RowMonth[]>(`/reports/sales-by-month${qs}`),
      api.get<DepositSummary>(`/reports/deposits${qs}`),
    ]);
    setSummary(summaryRow);
    setByCategory(cat);
    setBySku(sku);
    setByMonth(month);
    setDeposits(depositSummary);
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

  useEffect(() => {
    setSkuPage(1);
  }, [skuSearch, skuPageSize, reportType]);

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
              onChange={(e) =>
                setChannel(e.target.value as "" | "B2B" | "B2C" | "WEB")
              }
            >
              <option value="">Todos</option>
              <option value="B2B">B2B</option>
              <option value="B2C">B2C</option>
              <option value="WEB">Web</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Tipo serie</span>
            <select
              className="input"
              value={seriesScope}
              onChange={(e) => setSeriesScope(e.target.value)}
            >
              <option value="">Todas</option>
              <option value="sale_b2c">Ventas B2C</option>
              <option value="sale_b2b">Ventas B2B</option>
              <option value="return">Devoluciones</option>
              <option value="deposit">Depositos</option>
              <option value="web">Web</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Serie</span>
            <input
              className="input"
              placeholder="Codigo serie"
              value={seriesCode}
              onChange={(e) => setSeriesCode(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Informe</span>
            <select
              className="input"
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "sku" | "category" | "month",
                )
              }
            >
              <option value="sku">Ventas por SKU</option>
              <option value="category">Ventas por categoria</option>
              <option value="month">Ventas por mes</option>
            </select>
          </label>
          {reportType === "sku" && (
            <label className="stack">
              <span className="muted">Buscar SKU</span>
              <input
                className="input"
                placeholder="SKU"
                value={skuSearch}
                onChange={(e) => setSkuSearch(e.target.value)}
              />
            </label>
          )}
          <label className="stack">
            <span className="muted">Accion</span>
            <button onClick={() => loadAll().catch((err) => setStatus(err.message))}>
              Actualizar
            </button>
          </label>
        </div>
      </div>

      <div className="card stack">
        <strong>Resumen de ventas</strong>
        {summary ? (
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="muted">Ingresos</span>
              <strong>{summary.revenue.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Ingresos cobrados</span>
              <strong>{summary.revenuePaid.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">
                {channel === "WEB"
                  ? "Pendientes web"
                  : "Ingresos pendientes"}
              </span>
              <strong>{summary.revenuePending.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Costes</span>
              <strong>{summary.cost.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Margen</span>
              <strong>{summary.margin.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Devoluciones (uds)</span>
              <strong>{summary.returnsUnits}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Devoluciones (ingreso)</span>
              <strong>{summary.returnsRevenue.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Devoluciones (coste)</span>
              <strong>{summary.returnsCost.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Unidades</span>
              <strong>{summary.units}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Ventas</span>
              <strong>{summary.orders}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Sin datos</p>
        )}
      </div>

      <div className="card stack">
        <strong>Depositos</strong>
        {deposits ? (
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="muted">Pendiente (uds)</span>
              <strong>{deposits.pendingUnits}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Pendiente (coste)</span>
              <strong>{deposits.pendingCost.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Convertido (uds)</span>
              <strong>{deposits.convertedUnits}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Convertido (ingreso)</span>
              <strong>{deposits.convertedRevenue.toFixed(2)}</strong>
            </div>
            <div className="kpi-card">
              <span className="muted">Devuelto (uds)</span>
              <strong>{deposits.returnedUnits}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Sin datos</p>
        )}
      </div>

      {reportType === "category" && (
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
      )}

      {reportType === "sku" && (
        <div className="card stack">
          <strong>Ventas por SKU</strong>
          <div className="row reports-sku-pagination">
            <div className="reports-sku-page-size">
              <span className="muted">Pagina</span>
              <select
                className="input"
                value={skuPageSize}
                onChange={(e) => setSkuPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
            <div className="row reports-sku-controls">
              <button
                onClick={() => setSkuPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <button
                onClick={() => {
                  const totalPages = Math.max(
                    1,
                    Math.ceil(
                      bySku.filter((row) =>
                        skuSearch.trim()
                          ? row.sku
                              .toLowerCase()
                              .includes(skuSearch.trim().toLowerCase())
                          : true,
                      ).length / skuPageSize,
                    ),
                  );
                  setSkuPage((prev) => Math.min(totalPages, prev + 1));
                }}
              >
                Siguiente
              </button>
              <span className="muted reports-sku-page-indicator">
                Pag {skuPage}
              </span>
            </div>
          </div>
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
              {bySku
                .filter((row) =>
                  skuSearch.trim()
                    ? row.sku
                        .toLowerCase()
                        .includes(skuSearch.trim().toLowerCase())
                    : true,
                )
                .slice(
                  (skuPage - 1) * skuPageSize,
                  skuPage * skuPageSize,
                )
                .map((row) => (
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
      )}

      {reportType === "month" && (
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
      )}

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
