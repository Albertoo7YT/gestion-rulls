"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "../../lib/api";

type Location = {
  id: number;
  name: string;
  type: "warehouse" | "retail";
};

type StockRow = {
  sku: string;
  name: string;
  quantity: number;
};

export default function StockPage() {
  const params = useSearchParams();
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationKey, setLocationKey] = useState<string>("");
  const [stock, setStock] = useState<StockRow[]>([]);
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
              <th>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((row) => (
              <tr key={row.sku}>
                <td>{row.sku}</td>
                <td>{row.name}</td>
                <td>{row.quantity}</td>
              </tr>
            ))}
            {stock.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sin stock para esta ubicacion
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
