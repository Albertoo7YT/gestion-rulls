"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { filterAndScoreSkus } from "../../lib/sku-search";

type Product = {
  sku: string;
  name: string;
  photoUrl: string | null;
  manufacturerRef?: string | null;
  color?: string | null;
  rrp: number | null;
  categoryNames?: string[];
};

type Category = { id: number; name: string };

const STORAGE_KEY = "catalog_selected_skus";
const STORAGE_MODE_KEY = "catalog_mode";
const STORAGE_CATEGORIES_KEY = "catalog_selected_categories";

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(true);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"manual" | "categories">("manual");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
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
    const modeRaw =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_MODE_KEY)
        : null;
    if (modeRaw === "categories" || modeRaw === "manual") {
      setMode(modeRaw);
    }
    const categoriesRaw =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_CATEGORIES_KEY)
        : null;
    if (categoriesRaw) {
      try {
        const list = JSON.parse(categoriesRaw) as number[];
        setSelectedCategoryIds(list);
      } catch {
        setSelectedCategoryIds([]);
      }
    }
  }, []);

  async function loadProducts() {
    setStatus(null);
    const data = await api.get<Product[]>("/products");
    setProducts(data);
  }

  async function loadCategories() {
    const data = await api.get<Category[]>("/categories");
    setCategories(data);
  }

  useEffect(() => {
    Promise.all([loadProducts(), loadCategories()]).catch((err) =>
      setStatus(err.message),
    );
  }, []);

  const filtered = useMemo(() => {
    const scored = filterAndScoreSkus(products, search);
    const scoreMap = new Map(scored.map(({ item, score }) => [item.sku, score]));
    const sorted = scored.map(({ item }) => item);
    sorted.sort((a, b) => {
      const scoreA = scoreMap.get(a.sku) ?? 0;
      const scoreB = scoreMap.get(b.sku) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.sku.localeCompare(b.sku);
    });
    return sorted;
  }, [products, search]);

  const selectedCategoryNames = useMemo(() => {
    return categories
      .filter((c) => selectedCategoryIds.includes(c.id))
      .map((c) => c.name);
  }, [categories, selectedCategoryIds]);

  const selectedProducts = useMemo(() => {
    if (mode === "categories") {
      if (selectedCategoryNames.length === 0) return [];
      return products.filter((p) =>
        (p.categoryNames ?? []).some((name) =>
          selectedCategoryNames.includes(name),
        ),
      );
    }
    return products.filter((p) => selectedSkus.has(p.sku));
  }, [products, selectedSkus, mode, selectedCategoryNames]);

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
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    localStorage.setItem(
      STORAGE_CATEGORIES_KEY,
      JSON.stringify(selectedCategoryIds),
    );
    setStatus("Catalogo guardado");
  }

  async function downloadPdf() {
    const skus = selectedProducts.map((p) => p.sku);
    if (skus.length === 0) {
      setStatus("Selecciona productos antes de generar el PDF");
      return;
    }
    setStatus("Generando PDF...");
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
      "http://localhost:3001";
    const res = await fetch(`${baseUrl}/catalog/pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ skus }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalogo.pdf";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("PDF generado");
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
        <div className="row catalog-actions">
          <button onClick={() => setEditing((prev) => !prev)}>
            {editing ? "Ver catalogo" : "Editar catalogo"}
          </button>
          <button className="secondary" onClick={saveSelection}>
            Guardar seleccion
          </button>
          <button className="secondary" onClick={downloadPdf}>
            PDF catalogo
          </button>
        </div>
      </div>

      {editing && (
        <div className="card stack">
          <div className="row">
            <label className="stack">
              <span className="muted">Modo catalogo</span>
              <select
                className="input"
                value={mode}
                onChange={(e) =>
                  setMode(e.target.value === "categories" ? "categories" : "manual")
                }
              >
                <option value="manual">Seleccion manual</option>
                <option value="categories">Por categorias</option>
              </select>
            </label>
            <span className="muted">
              Productos incluidos: {selectedProducts.length}
            </span>
          </div>

          {mode === "categories" && (
            <div className="catalog-picker">
              {categories.map((c) => (
                <label className="catalog-picker-item" key={c.id}>
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(c.id)}
                    onChange={(e) => {
                      const set = new Set(selectedCategoryIds);
                      if (e.target.checked) set.add(c.id);
                      else set.delete(c.id);
                      setSelectedCategoryIds(Array.from(set));
                    }}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
              {categories.length === 0 && (
                <div className="muted">Sin categorias</div>
              )}
            </div>
          )}

          {mode === "manual" && (
            <>
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
            </>
          )}
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
