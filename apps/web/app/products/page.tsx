"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../lib/api";
import CsvMappingWizard from "../../components/csv-mapping-wizard";
import { filterAndScoreSkus } from "../../lib/sku-search";

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
  engravingCost?: number | null;
  rrp: number | null;
  b2bPrice?: number | null;
  active: boolean;
  stock?: number;
  categoryIds?: number[];
  categoryNames?: string[];
};

type Category = { id: number; name: string };
type Accessory = {
  id: number;
  name: string;
  cost: number | null;
  price: number | null;
  active: boolean;
};
type Location = {
  id: number;
  name: string;
  active: boolean;
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accessories, setAccessories] = useState<Accessory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [stockLocationId, setStockLocationId] = useState<number | "">("");
  const [stockBySku, setStockBySku] = useState<Record<string, number>>({});
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
    engravingCost: "",
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
    engravingCost: "",
    rrp: "",
    b2bPrice: "",
    active: true,
    categoryIds: [] as number[],
  });
  const [showStandardForm, setShowStandardForm] = useState(false);
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAccessoryForm, setShowAccessoryForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editingLoading, setEditingLoading] = useState(false);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());
  const [onlyUpdateExisting, setOnlyUpdateExisting] = useState(false);
  const [stockImportMode, setStockImportMode] = useState<"add" | "replace">(
    "add",
  );
  const [accessoryForm, setAccessoryForm] = useState({
    name: "",
    cost: "",
    price: "",
    active: true,
  });

  const filtered = useMemo(() => {
    const scored = filterAndScoreSkus(products, search);
    const scoreMap = new Map(scored.map(({ item, score }) => [item.sku, score]));
    const sorted = scored.map(({ item }) => item);
    sorted.sort((a, b) => {
      const scoreA = scoreMap.get(a.sku) ?? 0;
      const scoreB = scoreMap.get(b.sku) ?? 0;
      if (scoreA !== scoreB) return scoreA - scoreB;
      switch (sortBy) {
        case "name-desc":
          return a.name.localeCompare(b.name) * -1;
        case "sku-asc":
          return a.sku.localeCompare(b.sku);
        case "sku-desc":
          return a.sku.localeCompare(b.sku) * -1;
        case "stock-asc":
          return (stockBySku[a.sku] ?? a.stock ?? 0) - (stockBySku[b.sku] ?? b.stock ?? 0);
        case "stock-desc":
          return (stockBySku[b.sku] ?? b.stock ?? 0) - (stockBySku[a.sku] ?? a.stock ?? 0);
        case "pvp-asc":
          return (a.rrp ?? 0) - (b.rrp ?? 0);
        case "pvp-desc":
          return (b.rrp ?? 0) - (a.rrp ?? 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [products, search, sortBy, stockBySku]);

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

  async function loadAccessories() {
    const data = await api.get<Accessory[]>("/accessories");
    setAccessories(data);
  }

  async function loadLocations() {
    const data = await api.get<Location[]>("/locations");
    const active = data.filter((loc) => loc.active);
    setLocations(active);
    if (active.length > 0 && stockLocationId === "") {
      setStockLocationId(active[0].id);
    }
  }

  async function loadStockForLocation(locationId: number) {
    const rows = await api.get<
      { sku: string; quantity: number; name: string | null }[]
    >(`/stock?locationId=${locationId}`);
    const map: Record<string, number> = {};
    for (const row of rows) {
      map[row.sku] = row.quantity;
    }
    setStockBySku(map);
  }

  useEffect(() => {
    Promise.all([
      loadProducts(),
      loadCategories(),
      loadAccessories(),
      loadLocations(),
    ]).catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (typeof stockLocationId === "number") {
      loadStockForLocation(stockLocationId).catch((err) =>
        setStatus(err.message),
      );
    } else {
      setStockBySku({});
    }
  }, [stockLocationId]);

  async function createQuick() {
    setStatus(null);
    const name = quickForm.name.trim();
    if (!name) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    const extraPhotos = parsePhotoUrls(quickForm.photoUrls);
    try {
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
        engravingCost: toNumberOrUndefined(quickForm.engravingCost),
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
        engravingCost: "",
        rrp: "",
      });
      await loadProducts();
      setStatus("TMP creado.");
    } catch (err: any) {
      setStatus(err?.message ?? "No se pudo crear el TMP.");
    }
  }

  async function createQuickFull() {
    setStatus(null);
    if (!standardForm.name.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    const extraPhotos = parsePhotoUrls(standardForm.photoUrls);
    try {
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
        engravingCost: toNumberOrUndefined(standardForm.engravingCost),
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
        engravingCost: "",
        rrp: "",
        b2bPrice: "",
        active: true,
        categoryIds: [],
      });
      await loadProducts();
      setStatus("TMP creado.");
    } catch (err: any) {
      setStatus(err?.message ?? "No se pudo crear el TMP.");
    }
  }

  function startAccessoryCreate() {
    setEditingAccessory(null);
    setAccessoryForm({ name: "", cost: "", price: "", active: true });
    setShowAccessoryForm(true);
  }

  function startAccessoryEdit(accessory: Accessory) {
    setEditingAccessory(accessory);
    setAccessoryForm({
      name: accessory.name,
      cost: accessory.cost !== null ? String(accessory.cost) : "",
      price: accessory.price !== null ? String(accessory.price) : "",
      active: accessory.active,
    });
    setShowAccessoryForm(true);
  }

  function cancelAccessoryEdit() {
    setEditingAccessory(null);
    setAccessoryForm({ name: "", cost: "", price: "", active: true });
    setShowAccessoryForm(false);
  }

  async function saveAccessory() {
    const name = accessoryForm.name.trim();
    if (!name) return;
    const payload = {
      name,
      cost: toNumberOrUndefined(accessoryForm.cost),
      price: toNumberOrUndefined(accessoryForm.price),
      active: accessoryForm.active,
    };
    if (editingAccessory) {
      await api.put(`/accessories/${editingAccessory.id}`, payload);
    } else {
      await api.post("/accessories", payload);
    }
    cancelAccessoryEdit();
    await loadAccessories();
  }

  async function toggleAccessoryActive(accessory: Accessory, active: boolean) {
    await api.put(`/accessories/${accessory.id}`, { active });
    await loadAccessories();
  }

  async function removeAccessory(accessory: Accessory) {
    const ok = window.confirm(`Eliminar accesorio "${accessory.name}"?`);
    if (!ok) return;
    await api.del(`/accessories/${accessory.id}`);
    await loadAccessories();
  }

  function toNumberOrUndefined(value: string | number | null) {
    if (value === "" || value === null || typeof value === "undefined") {
      return undefined;
    }
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  function parseCsvNumber(value?: string) {
    if (!value) return undefined;
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  }

  async function createStandard() {
    setStatus(null);
    if (!standardForm.sku.trim() || !standardForm.name.trim()) {
      setStatus("SKU y nombre son obligatorios.");
      return;
    }
    const extraPhotos = parsePhotoUrls(standardForm.photoUrls);
    try {
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
        engravingCost: toNumberOrUndefined(standardForm.engravingCost),
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
        engravingCost: "",
        rrp: "",
        b2bPrice: "",
        active: true,
        categoryIds: [],
      });
      await loadProducts();
      setStatus("Producto creado.");
    } catch (err: any) {
      setStatus(err?.message ?? "No se pudo crear el producto.");
    }
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

  async function importProductsCsv(rows: Record<string, string>[]) {
    setStatus(null);
    setImportStatus(null);
    const existingSkus = new Set(products.map((p) => p.sku));
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      const sku = row.sku?.trim();
      const name = row.name?.trim();
      if (!sku && !name) {
        skipped += 1;
        continue;
      }
      const extraPhotos = parsePhotoUrls(row.photoUrls);
      const payload = {
        sku,
        name,
        photoUrl: row.photoUrl?.trim() || extraPhotos[0] || undefined,
        photoUrls: extraPhotos.length ? extraPhotos : undefined,
        description: row.description?.trim() || undefined,
        manufacturerRef: row.manufacturerRef?.trim() || undefined,
        color: row.color?.trim() || undefined,
        cost: parseCsvNumber(row.cost),
        engravingCost: parseCsvNumber(row.engravingCost),
        rrp: parseCsvNumber(row.rrp),
        b2bPrice: parseCsvNumber(row.b2bPrice),
        active: row.active ? row.active !== "false" : true,
        categoryIds: parseCategoryIds(row.categoryIds),
      };
      const type = (row.type ?? "standard").toLowerCase();
      if (!sku || sku.length === 0) {
        skipped += 1;
        continue;
      }
      if (!name) {
        if (sku && existingSkus.has(sku)) {
          const { sku: _sku, name: _name, ...updatePayload } = payload;
          if (Object.keys(updatePayload).length > 0) {
            await api.put(`/products/${encodeURIComponent(sku)}`, updatePayload);
            updated += 1;
          } else {
            skipped += 1;
          }
        } else {
          skipped += 1;
        }
        continue;
      }
      if (onlyUpdateExisting && (!sku || !existingSkus.has(sku))) {
        skipped += 1;
        continue;
      }
      if (type === "quick" && !sku) {
        await api.post("/products/quick", payload);
        created += 1;
      } else if (sku) {
        await api.post("/products", payload);
        created += 1;
      } else {
        skipped += 1;
      }
    }
    await loadProducts();
    setImportStatus(
      `Importados: ${created} nuevos, ${updated} actualizados, ${skipped} omitidos.`,
    );
  }

  async function importStockCsv(rows: Record<string, string>[]) {
    setStatus(null);
    setImportStatus(null);
    const grouped: Record<
      string,
      { sku: string; quantity: number; unitCost?: number }[]
    > = {};
    const knownSkus = new Set(products.map((p) => p.sku));
    let skippedMissing = 0;
    let skippedInvalid = 0;
    let totalRows = 0;
    for (const row of rows) {
      totalRows += 1;
      const locationId = row.locationId?.trim();
      const sku = row.sku?.trim();
      const quantity = Number((row.quantity ?? "").replace(",", "."));
      if (!locationId || !sku || !Number.isFinite(quantity) || quantity < 1) {
        skippedInvalid += 1;
        continue;
      }
      if (!knownSkus.has(sku)) {
        skippedMissing += 1;
        continue;
      }
      const unitCost = parseCsvNumber(row.unitCost);
      if (!grouped[locationId]) grouped[locationId] = [];
      grouped[locationId].push({ sku, quantity, unitCost });
    }

    for (const [locationId, lines] of Object.entries(grouped)) {
      const locationIdNum = Number(locationId);
      if (stockImportMode === "add") {
        await api.post("/moves/purchase", {
          toId: locationIdNum,
          lines,
        });
        continue;
      }

      const currentRows = await api.get<{ sku: string; quantity: number }[]>(
        `/stock?locationId=${locationIdNum}`,
      );
      const currentMap = new Map(
        currentRows.map((row) => [row.sku, row.quantity]),
      );
      const targetMap = new Map<string, { quantity: number; unitCost?: number }>();
      for (const line of lines) {
        const existing = targetMap.get(line.sku);
        if (existing) {
          existing.quantity += line.quantity;
          if (line.unitCost != null) existing.unitCost = line.unitCost;
        } else {
          targetMap.set(line.sku, { quantity: line.quantity, unitCost: line.unitCost });
        }
      }

      const inLines: { sku: string; quantity: number; unitCost?: number }[] = [];
      const outLines: { sku: string; quantity: number; unitCost?: number }[] = [];
      for (const [sku, target] of targetMap) {
        const currentQty = currentMap.get(sku) ?? 0;
        const diff = target.quantity - currentQty;
        if (diff > 0) {
          inLines.push({ sku, quantity: diff, unitCost: target.unitCost });
        } else if (diff < 0) {
          outLines.push({ sku, quantity: Math.abs(diff), unitCost: target.unitCost });
        }
      }

      if (inLines.length) {
        await api.post("/moves/adjust", {
          locationId: locationIdNum,
          direction: "in",
          reference: "CSV-REPLACE",
          notes: "Ajuste por importacion CSV",
          lines: inLines,
        });
      }
      if (outLines.length) {
        await api.post("/moves/adjust", {
          locationId: locationIdNum,
          direction: "out",
          reference: "CSV-REPLACE",
          notes: "Ajuste por importacion CSV",
          lines: outLines,
        });
      }
    }
    setImportStatus(
      `Procesadas ${totalRows} filas. ${Object.keys(grouped).length} almacenes. Omitidas ${skippedMissing} filas por SKU inexistente y ${skippedInvalid} por cantidad invalida.`,
    );
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.sku) {
      setStatus("SKU invalido. Cierra y vuelve a abrir la edicion.");
      return;
    }
    setStatus(null);
    setEditingSaving(true);
    try {
      const extraPhotos = Array.isArray(editing.photoUrls)
        ? editing.photoUrls
        : parsePhotoUrls(String(editing.photoUrls || ""));
      const encodedSku = encodeURIComponent(editing.sku);
      await api.put(`/products/${encodedSku}`, {
        name: editing.name,
        photoUrl: editing.photoUrl || extraPhotos[0] || undefined,
        photoUrls: extraPhotos.length ? extraPhotos : undefined,
        description: editing.description || undefined,
        manufacturerRef: editing.manufacturerRef || undefined,
        color: editing.color || undefined,
        cost: toNumberOrUndefined(editing.cost),
        engravingCost: toNumberOrUndefined(editing.engravingCost ?? null),
        rrp: toNumberOrUndefined(editing.rrp),
        b2bPrice: toNumberOrUndefined(editing.b2bPrice ?? null),
        active: editing.active,
        categoryIds: editing.categoryIds,
      });
      setEditing(null);
      await loadProducts();
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    } finally {
      setEditingSaving(false);
    }
  }

  async function startEdit(sku: string) {
    setStatus(null);
    if (!sku) return;
    const existing = products.find((p) => p.sku === sku);
    if (existing) {
      setEditing(normalizeProduct(existing));
    }
    setEditingLoading(true);
    try {
      const detail = await api.get<Product>(`/products/${encodeURIComponent(sku)}`);
      const normalized = normalizeProduct(detail);
      if (existing) {
        setEditing({
          ...normalizeProduct(existing),
          ...normalized,
          categoryIds: normalized.categoryIds ?? existing.categoryIds,
          categoryNames: normalized.categoryNames ?? existing.categoryNames,
          photoUrls:
            normalized.photoUrls?.length ? normalized.photoUrls : existing.photoUrls,
        });
      } else {
        setEditing(normalized);
      }
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    } finally {
      setEditingLoading(false);
    }
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
            <span className="muted">Coste grabado</span>
            <input
              className="input"
              type="number"
              placeholder="Coste grabado"
              value={standardForm.engravingCost}
              onChange={(e) =>
                setStandardForm({
                  ...standardForm,
                  engravingCost: e.target.value,
                })
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
            <span className="muted">Coste grabado</span>
            <input
              className="input"
              type="number"
              placeholder="Coste grabado"
              value={quickForm.engravingCost}
              onChange={(e) =>
                setQuickForm({
                  ...quickForm,
                  engravingCost: e.target.value,
                })
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
          <label className="row">
            <input
              type="checkbox"
              checked={onlyUpdateExisting}
              onChange={(e) => setOnlyUpdateExisting(e.target.checked)}
            />
            Solo actualizar SKU existentes
          </label>
          <CsvMappingWizard
            title="Importar productos CSV"
            fields={[
              { key: "sku", label: "SKU" },
              { key: "name", label: "Nombre" },
              { key: "type", label: "Tipo (standard/quick)" },
              { key: "photoUrl", label: "Foto URL" },
              { key: "photoUrls", label: "Fotos extra (|)" },
              { key: "description", label: "Descripcion" },
              { key: "manufacturerRef", label: "Ref fabricante" },
              { key: "color", label: "Color" },
              { key: "cost", label: "Coste" },
              { key: "engravingCost", label: "Coste grabado" },
              { key: "rrp", label: "PVP" },
              { key: "b2bPrice", label: "Precio B2B" },
              { key: "active", label: "Activo" },
              { key: "categoryIds", label: "Categorias (ids |)" },
            ]}
            onImport={importProductsCsv}
            onStatus={setImportStatus}
          />
          <CsvMappingWizard
            title="Importar stock CSV"
            fields={[
              { key: "locationId", label: "Almacen (locationId)", required: true },
              { key: "sku", label: "SKU", required: true },
              { key: "quantity", label: "Cantidad", required: true },
              { key: "unitCost", label: "Coste unitario" },
            ]}
            onImport={importStockCsv}
            onStatus={setImportStatus}
          />
          <div className="row">
            <span className="muted">Modo stock</span>
            <label className="row">
              <input
                type="radio"
                name="stock-import-mode"
                checked={stockImportMode === "add"}
                onChange={() => setStockImportMode("add")}
              />
              Sumar
            </label>
            <label className="row">
              <input
                type="radio"
                name="stock-import-mode"
                checked={stockImportMode === "replace"}
                onChange={() => setStockImportMode("replace")}
              />
              Reemplazar
            </label>
          </div>
          {importStatus && <p className="muted">{importStatus}</p>}
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
          <label className="stack">
            <span className="muted">Stock (almacen)</span>
            <select
              className="input"
              value={stockLocationId}
              onChange={(e) =>
                setStockLocationId(e.target.value ? Number(e.target.value) : "")
              }
            >
              {locations.length === 0 && <option value="">Sin almacenes</option>}
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
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
                {p.manufacturerRef && (
                  <div className="muted">Ref: {p.manufacturerRef}</div>
                )}
                <div className="product-meta">
                  <span>
                    Stock: {stockBySku[p.sku] ?? p.stock ?? 0}
                  </span>
                  <span>PVP: {p.rrp ?? "-"}</span>
                  <span>B2B: {p.b2bPrice ?? "-"}</span>
                  <span>
                    Categorias:{" "}
                    {p.categoryNames && p.categoryNames.length > 0
                      ? p.categoryNames.join(", ")
                      : "-"}
                  </span>
                  {p.type === "quick" && <span>Tipo: quick</span>}
                  {!p.active && <span>Inactivo</span>}
                </div>
                <div className="row product-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setEditing(normalizeProduct(p));
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
                        const encodedSku = encodeURIComponent(p.sku);
                        await api.post(`/products/${encodedSku}/convert-to-standard`, {});
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
                      const encodedSku = encodeURIComponent(p.sku);
                      api
                        .del(`/products/${encodedSku}?hard=true`)
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

      <div className="card stack">
        <div className="row">
          <strong>Accesorios</strong>
          <div className="row">
            <button className="secondary" onClick={startAccessoryCreate}>
              Nuevo accesorio
            </button>
            {showAccessoryForm && (
              <button className="secondary" onClick={cancelAccessoryEdit}>
                Cancelar
              </button>
            )}
          </div>
        </div>
        {showAccessoryForm && (
          <div className="row">
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                placeholder="Nombre"
                value={accessoryForm.name}
                onChange={(e) =>
                  setAccessoryForm({ ...accessoryForm, name: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Coste</span>
              <input
                className="input"
                type="number"
                placeholder="Coste"
                value={accessoryForm.cost}
                onChange={(e) =>
                  setAccessoryForm({ ...accessoryForm, cost: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Precio sugerido</span>
              <input
                className="input"
                type="number"
                placeholder="Precio"
                value={accessoryForm.price}
                onChange={(e) =>
                  setAccessoryForm({ ...accessoryForm, price: e.target.value })
                }
              />
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={accessoryForm.active}
                onChange={(e) =>
                  setAccessoryForm({ ...accessoryForm, active: e.target.checked })
                }
              />
              Activo
            </label>
            <button onClick={saveAccessory}>
              {editingAccessory ? "Guardar" : "Crear"}
            </button>
          </div>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Coste</th>
              <th>Precio</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accessories.map((acc) => (
              <tr key={acc.id}>
                <td>{acc.name}</td>
                <td>{acc.cost ?? "-"}</td>
                <td>{acc.price ?? "-"}</td>
                <td>{acc.active ? "Activo" : "Inactivo"}</td>
                <td className="row">
                  <button className="secondary" onClick={() => startAccessoryEdit(acc)}>
                    Editar
                  </button>
                  <button
                    className="secondary"
                    onClick={() => toggleAccessoryActive(acc, !acc.active)}
                  >
                    {acc.active ? "Desactivar" : "Activar"}
                  </button>
                  <button className="delete-button" onClick={() => removeAccessory(acc)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {accessories.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin accesorios
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingLoading && (
        <div className="card stack">
          <strong>Cargando producto...</strong>
        </div>
      )}
      {editing && !editingLoading && (
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
              <span className="muted">Coste grabado</span>
              <input
                className="input"
                type="number"
                value={editing.engravingCost ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    engravingCost:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                placeholder="Coste grabado"
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
            <button onClick={saveEdit} type="button" disabled={editingSaving}>
              {editingSaving ? "Guardando..." : "Guardar"}
            </button>
            <button
              className="secondary"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancelar
            </button>
          </div>
          {status && <p className="muted">{status}</p>}
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
  const engravingCost =
    product.engravingCost === null || typeof product.engravingCost === "undefined"
      ? null
      : Number(product.engravingCost);
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
    engravingCost: Number.isFinite(engravingCost) ? engravingCost : null,
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
