"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type Product = {
  sku: string;
  name: string;
  photoUrl: string | null;
  manufacturerRef?: string | null;
  color?: string | null;
  rrp: number | null;
  categoryNames?: string[];
};

const STORAGE_KEY = "catalog_selected_skus";

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(true);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const list = JSON.parse(raw) as string[];
        setSelectedSkus(new Set(list));
      } catch {
        setSelectedSkus(new Set());
      }
    }
  }, []);

  async function loadProducts() {
    setStatus(null);
    const data = await api.get<Product[]>("/products");
    setProducts(data);
  }

  useEffect(() => {
    loadProducts().catch((err) => setStatus(err.message));
  }, []);

  const filtered = useMemo(() => {
    return products.filter((p) =>
      `${p.sku} ${p.name}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );
  }, [products, search]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedSkus.has(p.sku)),
    [products, selectedSkus],
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedSkus.has(p.sku));

  function toggleSelect(sku: string) {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((p) => next.delete(p.sku));
      } else {
        filtered.forEach((p) => next.add(p.sku));
      }
      return next;
    });
  }

  function saveSelection() {
    const list = Array.from(selectedSkus);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setStatus("Catalogo guardado");
  }

  return (
    <div className="stack">
      <div className="catalog-hero">
        <div>
          <h2>Catalogo</h2>
          <p className="muted">
            Selecciona las gafas que quieres mostrar en tu catalogo.
          </p>
        </div>
        <div className="row">
          <button onClick={() => setEditing((prev) => !prev)}>
            {editing ? "Ver catalogo" : "Editar catalogo"}
          </button>
          <button className="secondary" onClick={saveSelection}>
            Guardar seleccion
          </button>
          <a className="secondary button" href="/catalog/pdf" target="_blank">
            PDF catalogo
          </a>
        </div>
      </div>

      {editing && (
        <div className="card stack">
          <div className="row">
            <label className="stack">
              <span className="muted">Buscar</span>
              <input
                className="input"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <button
              className="secondary"
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filtered.length === 0}
            >
              {allFilteredSelected ? "Quitar seleccion" : "Seleccionar todo"}
            </button>
            <span className="muted">
              Seleccionados: {selectedSkus.size}
            </span>
          </div>

          <div className="catalog-picker">
            {filtered.map((p) => (
              <label className="catalog-picker-item" key={p.sku}>
                <input
                  type="checkbox"
                  checked={selectedSkus.has(p.sku)}
                  onChange={() => toggleSelect(p.sku)}
                />
                <span>
                  {p.name} ({p.sku})
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="muted">Sin productos</div>
            )}
          </div>
        </div>
      )}

      {!editing && (
        <div className="catalog-grid">
          {selectedProducts.map((p) => (
            <div className="catalog-card" key={p.sku}>
              <div className="catalog-image">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} />
                ) : (
                  <div className="product-placeholder">Sin imagen</div>
                )}
              </div>
              <div className="catalog-body">
                <div className="catalog-title">{p.name}</div>
                <div className="muted">{p.sku}</div>
                <div className="catalog-meta">
                  <span>{p.manufacturerRef ?? "-"}</span>
                  <span>{p.color ?? "-"}</span>
                </div>
                <div className="catalog-tags">
                  {(p.categoryNames ?? []).map((name) => (
                    <span key={name}>{name}</span>
                  ))}
                </div>
                <div className="catalog-price">
                  {p.rrp ? `${p.rrp} EUR` : "-"}
                </div>
              </div>
            </div>
          ))}
          {selectedProducts.length === 0 && (
            <div className="muted">No hay productos en el catalogo.</div>
          )}
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
