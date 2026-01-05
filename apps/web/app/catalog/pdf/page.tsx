"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

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
const LOGO_URL =
  "https://rulls.eu/wp-content/uploads/2025/12/Rulls-Eslogan-Blanco.png";

export default function CatalogPdfPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      setSelectedSkus([]);
      return;
    }
    try {
      const list = JSON.parse(raw) as string[];
      setSelectedSkus(list);
    } catch {
      setSelectedSkus([]);
    }
  }, []);

  useEffect(() => {
    api
      .get<Product[]>("/products")
      .then(setProducts)
      .catch((err) => setStatus(err.message));
  }, []);

  const selected = useMemo(
    () => products.filter((p) => selectedSkus.includes(p.sku)),
    [products, selectedSkus],
  );

  return (
    <div className="catalog-pdf">
      <div className="catalog-pdf-header">
        <div className="catalog-pdf-brand">
          <img src={LOGO_URL} alt="Rulls" />
          <div>
            <div className="catalog-pdf-title">Catalogo premium</div>
            <div className="catalog-pdf-subtitle">
              Seleccion curada de gafas
            </div>
          </div>
        </div>
        <div className="catalog-pdf-actions no-print">
          <button onClick={() => window.print()}>Descargar PDF</button>
          <button className="secondary" onClick={() => history.back()}>
            Volver
          </button>
        </div>
      </div>
      <div className="catalog-pdf-meta-line">
        {new Date().toLocaleDateString()}
      </div>
      {selected.length === 0 && (
        <div className="muted">
          No hay productos seleccionados en el catalogo.
        </div>
      )}
      <div className="catalog-pdf-grid">
        {selected.map((p) => (
          <div className="catalog-pdf-card" key={p.sku}>
            <div className="catalog-pdf-image">
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} />
              ) : (
                <div className="product-placeholder">Sin imagen</div>
              )}
            </div>
            <div className="catalog-pdf-body">
              <div className="catalog-pdf-title">{p.name}</div>
              <div className="catalog-pdf-sku">{p.sku}</div>
              <div className="catalog-pdf-meta">
                <span>{p.manufacturerRef ?? "-"}</span>
                <span>{p.color ?? "-"}</span>
              </div>
              <div className="catalog-pdf-tags">
                {(p.categoryNames ?? []).map((name) => (
                  <span key={name}>{name}</span>
                ))}
              </div>
              <div className="catalog-pdf-price">
                {p.rrp ? `${p.rrp} EUR` : "-"}
              </div>
            </div>
          </div>
        ))}
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
