"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";

type Product = {
  sku: string;
  name: string;
  type: "standard" | "quick";
  photoUrl: string | null;
  photoUrls?: string[] | null;
  description?: string | null;
  manufacturerRef?: string | null;
  color?: string | null;
  cost: number | null;
  rrp: number | null;
  b2bPrice?: number | null;
  active: boolean;
  stock?: number;
  categoryIds?: number[];
  categoryNames?: string[];
};

type Category = { id: number; name: string };

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");
  const [quickForm, setQuickForm] = useState({
    sku: "",
    name: "",
    photoUrl: "",
    photoDataUrl: "",
    photoUrls: "",
    description: "",
    manufacturerRef: "",
    color: "",
    cost: "",
    rrp: "",
  });
  const [standardForm, setStandardForm] = useState({
    sku: "",
    name: "",
    photoUrl: "",
    photoDataUrl: "",
    photoUrls: "",
    description: "",
    manufacturerRef: "",
    color: "",
    cost: "",
    rrp: "",
    b2bPrice: "",
    active: true,
    categoryIds: [] as number[],
  });
  const [showStandardForm, setShowStandardForm] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const list = products.filter((p) =>
      `${p.sku} ${p.name}`.toLowerCase().includes(search.toLowerCase()),
    );
    const sorted = [...list];
    switch (sortBy) {
      case "name-desc":
        sorted.sort((a, b) => a.name.localeCompare(b.name) * -1);
        break;
      case "sku-asc":
        sorted.sort((a, b) => a.sku.localeCompare(b.sku));
        break;
      case "sku-desc":
        sorted.sort((a, b) => a.sku.localeCompare(b.sku) * -1);
        break;
      case "stock-asc":
        sorted.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
        break;
      case "stock-desc":
        sorted.sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
        break;
      case "pvp-asc":
        sorted.sort((a, b) => (a.rrp ?? 0) - (b.rrp ?? 0));
        break;
      case "pvp-desc":
        sorted.sort((a, b) => (b.rrp ?? 0) - (a.rrp ?? 0));
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [products, search, sortBy]);

  const selectedCount = selectedSkus.size;
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

  async function applyBulkActive(active: boolean) {
    if (selectedSkus.size === 0) return;
    setStatus(null);
    const skus = Array.from(selectedSkus);
    await Promise.all(
      skus.map((sku) => api.put(`/products/${sku}`, { active })),
    );
    await loadProducts();
    setSelectedSkus(new Set());
  }

  async function applyBulkDelete() {
    if (selectedSkus.size === 0) return;
    const ok = window.confirm(
      `Eliminar ${selectedSkus.size} productos de forma definitiva?`,
    );
    if (!ok) return;
    setStatus(null);
    const skus = Array.from(selectedSkus);
    await Promise.all(skus.map((sku) => api.del(`/products/${sku}?hard=true`)));
    await loadProducts();
    setSelectedSkus(new Set());
  }

  async function loadProducts() {
    const data = await api.get<Product[]>("/products");
    const normalized = data.map(normalizeProduct);
    setProducts(normalized);
    const available = new Set(normalized.map((p) => p.sku));
    setSelectedSkus(
      (prev) => new Set(Array.from(prev).filter((sku) => available.has(sku))),
    );
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

  async function createQuick() {
    setStatus(null);
    const name = quickForm.name.trim();
    if (!name) return;
    const extraPhotos = parsePhotoUrls(quickForm.photoUrls);
    await api.post("/products/quick", {
      name,
      sku: quickForm.sku.trim() || undefined,
      photoUrl:
        quickForm.photoDataUrl ||
        quickForm.photoUrl.trim() ||
        extraPhotos[0] ||
        undefined,
      photoUrls: extraPhotos.length ? extraPhotos : undefined,
      description: quickForm.description.trim() || undefined,
      manufacturerRef: quickForm.manufacturerRef.trim() || undefined,
      color: quickForm.color.trim() || undefined,
      cost: toNumberOrUndefined(quickForm.cost),
      rrp: toNumberOrUndefined(quickForm.rrp),
    });
    setQuickForm({
      sku: "",
      name: "",
      photoUrl: "",
      photoDataUrl: "",
      photoUrls: "",
      description: "",
      manufacturerRef: "",
      color: "",
      cost: "",
      rrp: "",
    });
    await loadProducts();
  }

  async function createQuickFull() {
    setStatus(null);
    if (!standardForm.name.trim()) return;
    const extraPhotos = parsePhotoUrls(standardForm.photoUrls);
    await api.post("/products/quick", {
      name: standardForm.name.trim(),
      sku: standardForm.sku.trim() || undefined,
      photoUrl:
        standardForm.photoDataUrl ||
        standardForm.photoUrl.trim() ||
        extraPhotos[0] ||
        undefined,
      photoUrls: extraPhotos.length ? extraPhotos : undefined,
      description: standardForm.description.trim() || undefined,
      manufacturerRef: standardForm.manufacturerRef.trim() || undefined,
      color: standardForm.color.trim() || undefined,
      cost: toNumberOrUndefined(standardForm.cost),
      rrp: toNumberOrUndefined(standardForm.rrp),
      b2bPrice: toNumberOrUndefined(standardForm.b2bPrice),
      active: standardForm.active,
      categoryIds: standardForm.categoryIds,
    });
    setStandardForm({
      sku: "",
      name: "",
      photoUrl: "",
      photoDataUrl: "",
      photoUrls: "",
      description: "",
      manufacturerRef: "",
      color: "",
      cost: "",
      rrp: "",
      b2bPrice: "",
      active: true,
      categoryIds: [],
    });
    await loadProducts();
  }

  function toNumberOrUndefined(value: string | number | null) {
    if (value === "" || value === null || typeof value === "undefined") {
      return undefined;
    }
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  async function createStandard() {
    setStatus(null);
    if (!standardForm.sku.trim() || !standardForm.name.trim()) return;
    const extraPhotos = parsePhotoUrls(standardForm.photoUrls);
    await api.post("/products", {
      sku: standardForm.sku.trim(),
      name: standardForm.name.trim(),
      photoUrl:
        standardForm.photoDataUrl ||
        standardForm.photoUrl.trim() ||
        extraPhotos[0] ||
        undefined,
      photoUrls: extraPhotos.length ? extraPhotos : undefined,
      description: standardForm.description.trim() || undefined,
      manufacturerRef: standardForm.manufacturerRef.trim() || undefined,
      color: standardForm.color.trim() || undefined,
      cost: toNumberOrUndefined(standardForm.cost),
      rrp: toNumberOrUndefined(standardForm.rrp),
      b2bPrice: toNumberOrUndefined(standardForm.b2bPrice),
      active: standardForm.active,
      categoryIds: standardForm.categoryIds,
    });
    setStandardForm({
      sku: "",
      name: "",
      photoUrl: "",
      photoDataUrl: "",
      photoUrls: "",
      description: "",
      manufacturerRef: "",
      color: "",
      cost: "",
      rrp: "",
      b2bPrice: "",
      active: true,
      categoryIds: [],
    });
    await loadProducts();
  }

  function parseCategoryIds(value?: string) {
    if (!value) return [];
    return value
      .split("|")
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v));
  }

  function parsePhotoUrls(value?: string) {
    if (!value) return [];
    return value
      .split("|")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  async function importProductsCsv(file: File) {
    setStatus(null);
    const text = await file.text();
    const rows = parseCsv(text);
    for (const row of rows) {
      const sku = row.sku?.trim();
      const name = row.name?.trim();
      if (!name) continue;
      const extraPhotos = parsePhotoUrls(row.photoUrls);
      const payload = {
        sku,
        name,
        photoUrl: row.photoUrl?.trim() || extraPhotos[0] || undefined,
        photoUrls: extraPhotos.length ? extraPhotos : undefined,
        description: row.description?.trim() || undefined,
        manufacturerRef: row.manufacturerRef?.trim() || undefined,
        color: row.color?.trim() || undefined,
        cost: row.cost ? Number(row.cost) : undefined,
        rrp: row.rrp ? Number(row.rrp) : undefined,
        b2bPrice: row.b2bPrice ? Number(row.b2bPrice) : undefined,
        active: row.active ? row.active !== "false" : true,
        categoryIds: parseCategoryIds(row.categoryIds),
      };
      const type = (row.type ?? "standard").toLowerCase();
      if (type === "quick" && !sku) {
        await api.post("/products/quick", payload);
      } else if (sku) {
        await api.post("/products", payload);
      }
    }
    await loadProducts();
  }

  async function importStockCsv(file: File) {
    setStatus(null);
    const text = await file.text();
    const rows = parseCsv(text);
    const grouped: Record<string, { sku: string; quantity: number; unitCost?: number }[]> = {};
    for (const row of rows) {
      const locationId = row.locationId?.trim();
      const sku = row.sku?.trim();
      const quantity = Number(row.quantity);
      if (!locationId || !sku || !Number.isFinite(quantity)) continue;
      const unitCost = row.unitCost ? Number(row.unitCost) : undefined;
      if (!grouped[locationId]) grouped[locationId] = [];
      grouped[locationId].push({ sku, quantity, unitCost });
    }

    for (const [locationId, lines] of Object.entries(grouped)) {
      await api.post("/moves/purchase", {
        toId: Number(locationId),
        lines,
      });
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setStatus(null);
    const extraPhotos = Array.isArray(editing.photoUrls)
      ? editing.photoUrls
      : parsePhotoUrls(String(editing.photoUrls || ""));
    await api.put(`/products/${editing.sku}`, {
      name: editing.name,
      photoUrl: editing.photoUrl || extraPhotos[0] || undefined,
      photoUrls: extraPhotos.length ? extraPhotos : undefined,
      description: editing.description || undefined,
      manufacturerRef: editing.manufacturerRef || undefined,
      color: editing.color || undefined,
      cost: toNumberOrUndefined(editing.cost),
      rrp: toNumberOrUndefined(editing.rrp),
      b2bPrice: toNumberOrUndefined(editing.b2bPrice ?? null),
      active: editing.active,
      categoryIds: editing.categoryIds,
    });
    setEditing(null);
    await loadProducts();
  }

  async function startEdit(sku: string) {
    setStatus(null);
    const existing = products.find((p) => p.sku === sku);
    if (existing) {
      setEditing(normalizeProduct(existing));
    }
    const detail = await api.get<Product>(`/products/${sku}`);
    setEditing(normalizeProduct(detail));
  }

  async function handlePhotoFile(file: File) {
    const dataUrl = await toDataUrl(file);
    setStandardForm({ ...standardForm, photoDataUrl: dataUrl });
  }

  async function handleQuickPhotoFile(file: File) {
    const dataUrl = await toDataUrl(file);
    setQuickForm({ ...quickForm, photoDataUrl: dataUrl });
  }

  return (
    <div className="stack">
      <h2>Productos</h2>

      <div className="card stack">
        <div className="row products-actions products-actions-inline">
          <button onClick={() => setShowStandardForm((prev) => !prev)}>
            {showStandardForm ? "Ocultar" : "Anadir producto"}
          </button>
          <button
            className="secondary"
            onClick={() => setShowQuickForm((prev) => !prev)}
          >
            {showQuickForm ? "Ocultar quick" : "Crear quick"}
          </button>
          <button
            className="secondary"
            onClick={() => setShowImport((prev) => !prev)}
          >
            {showImport ? "Ocultar import" : "Importar CSV"}
          </button>
        </div>
      </div>

      {showStandardForm && (
        <div className="card stack">
        <strong>Crear standard</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">SKU</span>
            <input
              className="input"
              placeholder="SKU"
              value={standardForm.sku}
              onChange={(e) =>
                setStandardForm({ ...standardForm, sku: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Nombre</span>
            <input
              className="input"
              placeholder="Nombre"
              value={standardForm.name}
              onChange={(e) =>
                setStandardForm({ ...standardForm, name: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Foto URL</span>
            <input
              className="input"
              placeholder="Foto URL"
              value={standardForm.photoUrl}
              onChange={(e) =>
                setStandardForm({ ...standardForm, photoUrl: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Fotos extra (URLs separadas por |)</span>
            <input
              className="input"
              placeholder="https://...|https://..."
              value={standardForm.photoUrls}
              onChange={(e) =>
                setStandardForm({ ...standardForm, photoUrls: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Foto (camara/archivo)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) =>
                e.target.files?.[0] && handlePhotoFile(e.target.files[0])
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Ref fabricante</span>
            <input
              className="input"
              placeholder="Ref fabricante"
              value={standardForm.manufacturerRef}
              onChange={(e) =>
                setStandardForm({
                  ...standardForm,
                  manufacturerRef: e.target.value,
                })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Color</span>
            <input
              className="input"
              placeholder="Color"
              value={standardForm.color}
              onChange={(e) =>
                setStandardForm({ ...standardForm, color: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Descripcion</span>
            <input
              className="input"
              placeholder="Descripcion"
              value={standardForm.description}
              onChange={(e) =>
                setStandardForm({
                  ...standardForm,
                  description: e.target.value,
                })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Coste</span>
            <input
              className="input"
              type="number"
              placeholder="Coste"
              value={standardForm.cost}
              onChange={(e) =>
                setStandardForm({ ...standardForm, cost: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">PVP</span>
            <input
              className="input"
              type="number"
              placeholder="PVP"
              value={standardForm.rrp}
              onChange={(e) =>
                setStandardForm({ ...standardForm, rrp: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Precio B2B</span>
            <input
              className="input"
              type="number"
              placeholder="Precio B2B"
              value={standardForm.b2bPrice}
              onChange={(e) =>
                setStandardForm({ ...standardForm, b2bPrice: e.target.value })
              }
            />
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={standardForm.active}
              onChange={(e) =>
                setStandardForm({ ...standardForm, active: e.target.checked })
              }
            />
            Activo
          </label>
          <button onClick={createStandard}>Crear</button>
          <button className="secondary" onClick={createQuickFull}>
            Crear quick
          </button>
        </div>
        <div className="row">
          {categories.map((c) => (
            <label className="row" key={c.id}>
              <input
                type="checkbox"
                checked={standardForm.categoryIds.includes(c.id)}
                onChange={(e) => {
                  const set = new Set(standardForm.categoryIds);
                  if (e.target.checked) set.add(c.id);
                  else set.delete(c.id);
                  setStandardForm({
                    ...standardForm,
                    categoryIds: Array.from(set),
                  });
                }}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      )}

      {showQuickForm && (
        <div className="card stack">
        <strong>Crear quick</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">SKU (opcional)</span>
            <input
              className="input"
              placeholder="SKU"
              value={quickForm.sku}
              onChange={(e) =>
                setQuickForm({ ...quickForm, sku: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Nombre</span>
            <input
              className="input"
              placeholder="Nombre"
              value={quickForm.name}
              onChange={(e) =>
                setQuickForm({ ...quickForm, name: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Foto URL</span>
            <input
              className="input"
              placeholder="Foto URL"
              value={quickForm.photoUrl}
              onChange={(e) =>
                setQuickForm({ ...quickForm, photoUrl: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Fotos extra (URLs separadas por |)</span>
            <input
              className="input"
              placeholder="https://...|https://..."
              value={quickForm.photoUrls}
              onChange={(e) =>
                setQuickForm({ ...quickForm, photoUrls: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Foto (camara/archivo)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) =>
                e.target.files?.[0] && handleQuickPhotoFile(e.target.files[0])
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Ref fabricante</span>
            <input
              className="input"
              placeholder="Ref fabricante"
              value={quickForm.manufacturerRef}
              onChange={(e) =>
                setQuickForm({ ...quickForm, manufacturerRef: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Color</span>
            <input
              className="input"
              placeholder="Color"
              value={quickForm.color}
              onChange={(e) =>
                setQuickForm({ ...quickForm, color: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Descripcion</span>
            <input
              className="input"
              placeholder="Descripcion"
              value={quickForm.description}
              onChange={(e) =>
                setQuickForm({
                  ...quickForm,
                  description: e.target.value,
                })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">Coste</span>
            <input
              className="input"
              type="number"
              placeholder="Coste"
              value={quickForm.cost}
              onChange={(e) =>
                setQuickForm({ ...quickForm, cost: e.target.value })
              }
            />
          </label>
          <label className="stack">
            <span className="muted">PVP</span>
            <input
              className="input"
              type="number"
              placeholder="PVP"
              value={quickForm.rrp}
              onChange={(e) =>
                setQuickForm({ ...quickForm, rrp: e.target.value })
              }
            />
          </label>
          <button onClick={createQuick}>Crear TMP</button>
        </div>
        </div>
      )}

      {showImport && (
        <div className="card stack import-card">
        <strong>Importar CSV</strong>
        <p className="muted">
          Productos CSV: sku,name,type,photoUrl,photoUrls,description,manufacturerRef,color,cost,rrp,b2bPrice,active,categoryIds (ids separados por |)
        </p>
        <label className="stack">
          <span className="muted">CSV productos</span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) =>
              e.target.files?.[0] && importProductsCsv(e.target.files[0])
            }
          />
        </label>
        <p className="muted">
          Stock CSV: locationId,sku,quantity,unitCost
        </p>
        <label className="stack">
          <span className="muted">CSV stock</span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) =>
              e.target.files?.[0] && importStockCsv(e.target.files[0])
            }
          />
        </label>
        </div>
      )}

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
          <label className="stack">
            <span className="muted">Ordenar</span>
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Nombre (A-Z)</option>
              <option value="name-desc">Nombre (Z-A)</option>
              <option value="sku-asc">SKU (A-Z)</option>
              <option value="sku-desc">SKU (Z-A)</option>
              <option value="stock-desc">Stock (alto)</option>
              <option value="stock-asc">Stock (bajo)</option>
              <option value="pvp-desc">PVP (alto)</option>
              <option value="pvp-asc">PVP (bajo)</option>
            </select>
          </label>
          <button className="secondary" onClick={loadProducts}>
            Refrescar
          </button>
        </div>
        <div className="row bulk-actions">
          <button
            className="secondary"
            type="button"
            onClick={toggleSelectAllFiltered}
            disabled={filtered.length === 0}
          >
            {allFilteredSelected ? "Quitar seleccion" : "Seleccionar todo"}
          </button>
          <span className="muted">{selectedCount} seleccionados</span>
          <button
            className="secondary"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => applyBulkActive(true)}
          >
            Activar
          </button>
          <button
            className="secondary"
            type="button"
            disabled={selectedCount === 0}
            onClick={() => applyBulkActive(false)}
          >
            Desactivar
          </button>
          <button
            className="delete-button"
            type="button"
            disabled={selectedCount === 0}
            onClick={applyBulkDelete}
          >
            Eliminar
          </button>
        </div>
        <div className="product-grid">
          {filtered.map((p) => (
            <div
              key={p.sku}
              className={`product-card ${selectedSkus.has(p.sku) ? "selected" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                router.push(`/products/${encodeURIComponent(p.sku)}`)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/products/${encodeURIComponent(p.sku)}`);
                }
              }}
            >
              <label
                className="product-select"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSkus.has(p.sku)}
                  onChange={() => toggleSelect(p.sku)}
                />
              </label>
              <div className="product-image">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.name} />
                ) : (
                  <div className="product-placeholder">Sin imagen</div>
                )}
              </div>
              <div className="product-body">
                <div className="product-title">{p.name}</div>
                <div className="muted">{p.sku}</div>
                <div className="product-meta">
                  <span>Stock: {p.stock ?? 0}</span>
                  <span>PVP: {p.rrp ?? "-"}</span>
                  <span>B2B: {p.b2bPrice ?? "-"}</span>
                  <span>
                    Categorias:{" "}
                    {p.categoryNames && p.categoryNames.length > 0
                      ? p.categoryNames.join(", ")
                      : "-"}
                  </span>
                  <span>Tipo: {p.type}</span>
                  <span>Activo: {p.active ? "Si" : "No"}</span>
                </div>
                <div className="row product-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      startEdit(p.sku);
                    }}
                  >
                    Editar
                  </button>
                  {p.type === "quick" && (
                    <button
                      className="secondary"
                      type="button"
                      onClick={async (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setStatus(null);
                        await api.post(`/products/${p.sku}/convert-to-standard`, {});
                        await loadProducts();
                      }}
                    >
                      Convertir
                    </button>
                  )}
                  <button
                    className="delete-button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const confirmDelete = window.confirm(
                        `Seguro que quieres eliminar ${p.sku}?`,
                      );
                      if (!confirmDelete) return;
                      setStatus(null);
                      api
                        .del(`/products/${p.sku}?hard=true`)
                        .then(loadProducts)
                        .catch((err) => setStatus(err.message));
                    }}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="muted">Sin productos</div>}
        </div>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div
            className="card stack modal-card"
            onClick={(event) => event.stopPropagation()}
          >
          <strong>Editar {editing.sku}</strong>
          <div className="row">
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                placeholder="Nombre"
              />
            </label>
            <label className="stack">
              <span className="muted">Foto URL</span>
              <input
                className="input"
                value={editing.photoUrl ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, photoUrl: e.target.value })
                }
                placeholder="Foto URL"
              />
            </label>
            <label className="stack">
              <span className="muted">Fotos extra (URLs separadas por |)</span>
              <input
                className="input"
                value={
                  Array.isArray(editing.photoUrls)
                    ? editing.photoUrls.join("|")
                    : ""
                }
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    photoUrls: parsePhotoUrls(e.target.value),
                  })
                }
                placeholder="https://...|https://..."
              />
            </label>
            <label className="stack">
              <span className="muted">Ref fabricante</span>
              <input
                className="input"
                value={editing.manufacturerRef ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, manufacturerRef: e.target.value })
                }
                placeholder="Ref fabricante"
              />
            </label>
            <label className="stack">
              <span className="muted">Color</span>
              <input
                className="input"
                value={editing.color ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, color: e.target.value })
                }
                placeholder="Color"
              />
            </label>
            <label className="stack">
              <span className="muted">Descripcion</span>
              <input
                className="input"
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                placeholder="Descripcion"
              />
            </label>
            <label className="stack">
              <span className="muted">Coste</span>
              <input
                className="input"
                type="number"
                value={editing.cost ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    cost: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Coste"
              />
            </label>
            <label className="stack">
              <span className="muted">PVP</span>
              <input
                className="input"
                type="number"
                value={editing.rrp ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    rrp: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="PVP"
              />
            </label>
            <label className="stack">
              <span className="muted">Precio B2B</span>
              <input
                className="input"
                type="number"
                value={editing.b2bPrice ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    b2bPrice: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Precio B2B"
              />
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) =>
                  setEditing({ ...editing, active: e.target.checked })
                }
              />
              Activo
            </label>
          </div>
          <div className="row">
            {categories.map((c) => (
              <label className="row" key={c.id}>
                <input
                  type="checkbox"
                  checked={editing.categoryIds?.includes(c.id) ?? false}
                  onChange={(e) => {
                    const set = new Set(editing.categoryIds ?? []);
                    if (e.target.checked) set.add(c.id);
                    else set.delete(c.id);
                    setEditing({
                      ...editing,
                      categoryIds: Array.from(set),
                    });
                  }}
                />
                {c.name}
              </label>
            ))}
          </div>
          <div className="row">
            <button onClick={saveEdit}>Guardar</button>
            <button className="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
          </div>
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

function normalizeProduct(product: Product): Product {
  const cost =
    product.cost === null ? null : Number(product.cost);
  const rrp =
    product.rrp === null ? null : Number(product.rrp);
  const b2bPrice =
    product.b2bPrice === null || typeof product.b2bPrice === "undefined"
      ? null
      : Number(product.b2bPrice);
  const photoUrls = Array.isArray(product.photoUrls)
    ? product.photoUrls
    : [];
  return {
    ...product,
    cost: Number.isFinite(cost) ? cost : null,
    rrp: Number.isFinite(rrp) ? rrp : null,
    b2bPrice: Number.isFinite(b2bPrice) ? b2bPrice : null,
    photoUrls,
  };
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
