"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import { filterAndScoreSkus } from "../../lib/sku-search";

type Location = {
  id: number;
  name: string;
  type: "warehouse" | "retail";
};

type StockRow = {
  sku: string;
  name: string;
  manufacturerRef?: string | null;
  cost?: number | null;
  rrp?: number | null;
  quantity: number;
};

export default function StockPage() {
  const params = useSearchParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationKey, setLocationKey] = useState<string>("");
  const [stock, setStock] = useState<StockRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function loadStock(key: string, locs: Location[]) {
    setStatus(null);
    if (key === "total") {
      if (locs.length === 0) {
        setStock([]);
        return;
      }
      const rows = await Promise.all(
        locs.map((loc) =>
          api.get<StockRow[]>(`/stock?locationId=${loc.id}`),
        ),
      );
      const totals = new Map<string, StockRow>();
      rows.flat().forEach((row) => {
        const existing = totals.get(row.sku);
        if (existing) {
          existing.quantity += row.quantity;
        } else {
          totals.set(row.sku, { ...row });
        }
      });
      setStock(Array.from(totals.values()));
      return;
    }
    const numericId = Number(key);
    if (!Number.isFinite(numericId)) return;
    const data = await api.get<StockRow[]>(`/stock?locationId=${numericId}`);
    setStock(data);
  }

  useEffect(() => {
    const locationParam = params.get("locationId");
    api
      .get<Location[]>("/locations?type=warehouse")
      .then((data) => {
        setLocations(data);
        if (locationParam) {
          setLocationKey(locationParam);
          return;
        }
        if (data.length > 0) setLocationKey(String(data[0].id));
      })
      .catch((err) => setStatus(err.message));
  }, [params]);

  useEffect(() => {
    if (!locationKey) return;
    loadStock(locationKey, locations).catch((err) => setStatus(err.message));
  }, [locationKey, locations]);

  const filtered = useMemo(() => {
    const scored = filterAndScoreSkus(stock, search);
    const scoreMap = new Map(scored.map(({ item, score }) => [item.sku, score]));
    const sorted = scored.map(({ item }) => item);
    sorted.sort((a, b) => {
      const scoreA = scoreMap.get(a.sku) ?? 0;
      const scoreB = scoreMap.get(b.sku) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.sku.localeCompare(b.sku);
    });
    return sorted;
  }, [stock, search]);

  const totalQuantity = useMemo(
    () => filtered.reduce((acc, row) => acc + row.quantity, 0),
    [filtered],
  );
  const totalCostValue = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => acc + row.quantity * Number(row.cost ?? 0),
        0,
      ),
    [filtered],
  );
  const totalPvpValue = useMemo(
    () =>
      filtered.reduce(
        (acc, row) => acc + row.quantity * Number(row.rrp ?? 0),
        0,
      ),
    [filtered],
  );

  return (
    <div className="stack">
      <h2>Stock</h2>
      <div className="card stack">
        <div className="row">
          <label className="stack">
            <span className="muted">Almacen</span>
            <select
              className="input"
              value={locationKey}
              onChange={(e) => setLocationKey(e.target.value)}
            >
              <option value="total">Total</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span className="muted">Buscar (SKU o ref)</span>
            <input
              className="input"
              placeholder="SKU o ref interna"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            onClick={() =>
              locationKey && loadStock(locationKey, locations)
            }
          >
            Refrescar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Nombre</th>
              <th>Ref interna</th>
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.sku}>
                <td>{row.sku}</td>
                <td>{row.name}</td>
                <td>{row.manufacturerRef ?? "-"}</td>
                <td>{row.quantity}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  Sin stock para esta ubicacion
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Total</th>
              <th>{totalQuantity}</th>
            </tr>
            <tr>
              <th colSpan={3}>Valor stock (coste)</th>
              <th>{totalCostValue.toFixed(2)}</th>
            </tr>
            <tr>
              <th colSpan={3}>Valor stock (PVP)</th>
              <th>{totalPvpValue.toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
