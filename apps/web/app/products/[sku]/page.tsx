"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type ProductDetail = {
  sku: string;
  name: string;
  type: "standard" | "quick";
  photoUrl: string | null;
  photoUrls?: string[] | null;
  description?: string | null;
  manufacturerRef?: string | null;
  color?: string | null;
  cost: number | null;
  engravingCost?: number | null;
  rrp: number | null;
  b2bPrice?: number | null;
  active: boolean;
  categoryNames?: string[];
};

type MoveLine = {
  id: number;
  quantity: number;
  unitPrice: number | null;
  unitCost: number | null;
  move: {
    id: number;
    type: string;
    channel: string;
    date: string;
    reference: string | null;
    from: { id: number; name: string } | null;
    to: { id: number; name: string } | null;
  };
};

export default function ProductDetailPage({
  params,
}: {
  params: { sku: string };
}) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [moves, setMoves] = useState<MoveLine[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ProductDetail>(`/products/${params.sku}`)
      .then((data) => {
        setProduct(data);
        const list = Array.isArray(data.photoUrls) ? data.photoUrls : [];
        const withPrimary = data.photoUrl ? [data.photoUrl, ...list] : list;
        const unique = Array.from(new Set(withPrimary.filter(Boolean)));
        setSelectedImage(unique[0] ?? null);
      })
      .catch((err) => setStatus(err.message));

    api
      .get<MoveLine[]>(`/products/${params.sku}/moves`)
      .then(setMoves)
      .catch(() => null);
  }, [params.sku]);

  const images = useMemo(() => {
    if (!product) return [];
    const list = Array.isArray(product.photoUrls) ? product.photoUrls : [];
    const withPrimary = product.photoUrl ? [product.photoUrl, ...list] : list;
    return Array.from(new Set(withPrimary.filter(Boolean)));
  }, [product]);

  if (!product) {
    return (
      <div className="stack">
        <button
          className="secondary"
          onClick={() => (window.location.href = "/products")}
        >
          Volver
        </button>
        {status ? <p className="muted">{status}</p> : <p>Cargando...</p>}
      </div>
    );
  }

  return (
    <div className="stack product-detail">
      <button
        className="secondary"
        onClick={() => (window.location.href = "/products")}
      >
        Volver
      </button>
      <div className="card product-detail-card">
        <div className="product-detail-media">
          {selectedImage ? (
            <img src={selectedImage} alt={product.name} />
          ) : (
            <div className="product-placeholder">Sin imagen</div>
          )}
          {images.length > 1 && (
            <div className="product-thumbs">
              {images.map((img) => (
                <button
                  key={img}
                  className={`thumb ${img === selectedImage ? "active" : ""}`}
                  onClick={() => setSelectedImage(img)}
                  type="button"
                >
                  <img src={img} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-detail-info">
          <h2>{product.name}</h2>
          <div className="muted">{product.sku}</div>
          <div className="product-detail-grid">
            <div>
              <strong>Tipo</strong>
              <span>{product.type}</span>
            </div>
            <div>
              <strong>Categorias</strong>
              <span>
                {product.categoryNames && product.categoryNames.length > 0
                  ? product.categoryNames.join(", ")
                  : "-"}
              </span>
            </div>
            <div>
              <strong>Ref fabricante</strong>
              <span>{product.manufacturerRef ?? "-"}</span>
            </div>
            <div>
              <strong>Color</strong>
              <span>{product.color ?? "-"}</span>
            </div>
            <div>
              <strong>Coste</strong>
              <span>{product.cost ?? "-"}</span>
            </div>
            <div>
              <strong>Coste grabado</strong>
              <span>{product.engravingCost ?? "-"}</span>
            </div>
            <div>
              <strong>PVP</strong>
              <span>{product.rrp ?? "-"}</span>
            </div>
            <div>
              <strong>B2B</strong>
              <span>{product.b2bPrice ?? "-"}</span>
            </div>
            <div>
              <strong>Activo</strong>
              <span>{product.active ? "Si" : "No"}</span>
            </div>
          </div>
          <div>
            <strong>Descripcion</strong>
            <p className="muted">{product.description || "-"}</p>
          </div>
        </div>
      </div>

      <div className="card stack">
        <strong>Historial de movimientos</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Cantidad</th>
              <th>Precio/Coste</th>
              <th>Referencia</th>
            </tr>
          </thead>
          <tbody>
            {moves.map((line) => {
              const price =
                line.unitPrice !== null ? line.unitPrice : line.unitCost;
              return (
                <tr key={line.id}>
                  <td>{new Date(line.move.date).toLocaleString()}</td>
                  <td>{line.move.type}</td>
                  <td>{line.move.from?.name ?? "-"}</td>
                  <td>{line.move.to?.name ?? "-"}</td>
                  <td>{line.quantity}</td>
                  <td>{price ?? "-"}</td>
                  <td>{line.move.reference ?? "-"}</td>
                </tr>
              );
            })}
            {moves.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Sin movimientos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
