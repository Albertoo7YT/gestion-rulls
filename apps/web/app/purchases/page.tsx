"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import CsvMappingWizard from "../../components/csv-mapping-wizard";

type Supplier = { id: number; name: string };

type Product = {
  sku: string;
  name: string;
  type?: "standard" | "quick";
  cost?: string | null;
  manufacturerRef?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[] | null;
  color?: string | null;
};

type Location = { id: number; name: string; type: string };

type PurchaseOrderLine = {
  id?: number;
  sku: string;
  productName?: string;
  manufacturerRef?: string;
  productType?: "standard" | "quick";
  quantity: number;
  unitCost?: number | null;
};

type PurchaseOrder = {
  id: number;
  number: string;
  status: string;
  supplier: Supplier;
  createdAt: string;
  receivedAt?: string | null;
  lines: PurchaseOrderLine[];
};

export default function PurchasesPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [csvStatus, setCsvStatus] = useState<string | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    number: "",
    supplierId: "",
    status: "draft",
    notes: "",
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [lineDraft, setLineDraft] = useState({
    sku: "",
    productName: "",
    manufacturerRef: "",
    productType: "standard" as "standard" | "quick",
    quantity: 1,
    unitCost: "",
  });
  const [receiveWarehouseId, setReceiveWarehouseId] = useState("");
  const [receiveDate, setReceiveDate] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");

  const normalizeSku = (value: string) =>
    value.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  const stripLeadingZeros = (value: string) => value.replace(/^0+(?=\d)/, "");

  const normalizeRefLike = (value: string) => {
    const normalized = normalizeSku(value);
    const ruMatch = normalized.match(/^RU(\d+)$/);
    if (ruMatch) return `RU${stripLeadingZeros(ruMatch[1])}`;
    if (/^\d+$/.test(normalized)) return stripLeadingZeros(normalized);
    return normalized;
  };

  const getSkuNumber = (value: string) => {
    const match = normalizeRefLike(value).match(/(\d+)$/);
    return match ? stripLeadingZeros(match[1]) : "";
  };

  const findProductBySku = (value: string) => {
    const needle = normalizeRefLike(value);
    if (!needle) return null;
    return products.find((p) => normalizeRefLike(p.sku) === needle) ?? null;
  };

  const findProductByManufacturerRef = (value: string) => {
    const needle = normalizeRefLike(value);
    if (!needle) return null;
    const matches = products.filter(
      (p) => normalizeRefLike(p.manufacturerRef ?? "") === needle,
    );
    if (matches.length === 1) return matches[0];
    return null;
  };

  const findProductByPrefix = (value: string) => {
    const needle = normalizeRefLike(value);
    if (!needle) return null;
    const matches = products.filter((p) =>
      normalizeRefLike(p.sku).startsWith(needle),
    );
    if (matches.length === 1) return matches[0];
    return null;
  };

  const findProductByNumber = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const normalizedNumber = stripLeadingZeros(trimmed);
    const matches = products.filter(
      (p) => getSkuNumber(p.sku) === normalizedNumber,
    );
    if (matches.length === 1) return matches[0];
    return null;
  };

  const selectedProduct = useMemo(() => {
    return (
      findProductBySku(lineDraft.sku) ||
      findProductByManufacturerRef(lineDraft.sku) ||
      findProductByNumber(lineDraft.sku) ||
      findProductByPrefix(lineDraft.sku)
    );
  }, [lineDraft.sku, products]);

  const getProductImage = (product: Product) => {
    if (product.photoUrl) return product.photoUrl;
    if (Array.isArray(product.photoUrls) && product.photoUrls.length > 0) {
      return product.photoUrls[0] ?? null;
    }
    return null;
  };

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim();
    if (!term) return products;
    const termText = term.toLowerCase();
    const termRef = normalizeRefLike(term);
    return products.filter((p) => {
      const textHaystack =
        `${p.sku} ${p.name} ${p.manufacturerRef ?? ""} ${p.color ?? ""}`.toLowerCase();
      if (textHaystack.includes(termText)) return true;
      const refHaystack = `${normalizeRefLike(p.sku)} ${normalizeRefLike(p.manufacturerRef ?? "")}`;
      return termRef.length > 0 && refHaystack.includes(termRef);
    });
  }, [productSearch, products]);

  useEffect(() => {
    Promise.all([
      api.get<PurchaseOrder[]>("/purchase-orders"),
      api.get<Supplier[]>("/suppliers"),
      api.get<Product[]>("/products"),
      api.get<Location[]>("/locations?type=warehouse"),
    ])
      .then(([ordersData, suppliersData, productsData, locationsData]) => {
        setOrders(ordersData);
        setSuppliers(suppliersData);
        setProducts(productsData);
        setWarehouses(locationsData);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  async function refreshOrders() {
    setOrders(await api.get("/purchase-orders"));
  }

  function resetEditor() {
    setForm({ number: "", supplierId: "", status: "draft", notes: "" });
    setLines([]);
    setEditingOrderId(null);
    setCsvStatus(null);
    setShowCsvImport(false);
    setShowForm(false);
  }

  function openNewEntry() {
    setForm({ number: "", supplierId: "", status: "draft", notes: "" });
    setLines([]);
    setEditingOrderId(null);
    setCsvStatus(null);
    setShowCsvImport(false);
    setShowForm(true);
  }

  async function handleCsvImport(rows: Record<string, string>[]) {
    const parsed: PurchaseOrderLine[] = [];
    let skipped = 0;
    for (const row of rows) {
      const sku = row.sku?.trim();
      if (!sku) {
        skipped += 1;
        continue;
      }
      const product = findProductBySku(sku);
      if (!product) {
        skipped += 1;
        continue;
      }
      const qty = Number(row.quantity || 1);
      if (!Number.isFinite(qty) || qty <= 0) {
        skipped += 1;
        continue;
      }
      const cost = row.unitCost ? Number(row.unitCost) : undefined;
      parsed.push({
        sku: product.sku,
        productName: product.name || undefined,
        manufacturerRef: product.manufacturerRef || undefined,
        productType: product.type === "quick" ? "quick" : "standard",
        quantity: qty,
        unitCost: Number.isFinite(cost) ? cost : undefined,
      });
    }
    if (!parsed.length) {
      setCsvStatus("No se encontraron lineas validas en el CSV.");
      return;
    }
    setLines((prev) => [...prev, ...parsed]);
    setCsvStatus(
      `Importadas ${parsed.length} lineas.${skipped ? ` ${skipped} ignoradas (SKU invalido o cantidad).` : ""}`,
    );
  }

  function addLine() {
    if (!lineDraft.sku) {
      setStatus("Selecciona un producto.");
      return;
    }
    if (!selectedProduct) {
      setStatus("El producto no existe. Crea la ficha antes de añadir la entrada.");
      return;
    }
    if (lineDraft.quantity < 1) {
      setStatus("La cantidad debe ser mayor que 0.");
      return;
    }
    setStatus(null);
    setLines([
      ...lines,
      {
        sku: selectedProduct.sku,
        productName: selectedProduct.name || lineDraft.productName || undefined,
        manufacturerRef:
          selectedProduct.manufacturerRef || lineDraft.manufacturerRef || undefined,
        productType: selectedProduct.type || lineDraft.productType,
        quantity: lineDraft.quantity,
        unitCost: lineDraft.unitCost ? Number(lineDraft.unitCost) : undefined,
      },
    ]);
    setLineDraft({
      sku: "",
      productName: "",
      manufacturerRef: "",
      productType: "standard",
      quantity: 1,
      unitCost: "",
    });
  }

  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function createOrder() {
    if (!form.supplierId) {
      setStatus("Selecciona un proveedor.");
      return;
    }
    if (!lines.length) {
      setStatus("Anade al menos una linea.");
      return;
    }
    setStatus(null);
    const payload = {
      number: form.number.trim() || undefined,
      supplierId: Number(form.supplierId),
      status: form.status,
      notes: form.notes,
      lines,
    };
    if (editingOrderId) {
      await api.put(`/purchase-orders/${editingOrderId}`, payload);
    } else {
      await api.post("/purchase-orders", payload);
    }
    resetEditor();
    await refreshOrders();
  }

  async function receiveOrder(orderId: number) {
    if (!receiveWarehouseId) {
      setStatus("Selecciona un almacen para recibir.");
      return;
    }
    setStatus(null);
    await api.post(`/purchase-orders/${orderId}/receive`, {
      warehouseId: Number(receiveWarehouseId),
      date: receiveDate || undefined,
      notes: receiveNotes || undefined,
    });
    setReceiveNotes("");
    await refreshOrders();
  }

  return (
    <div className="stack">
      <h2>Entradas</h2>
      <div className="row">
        <button className="btn-block" onClick={openNewEntry}>
          Nueva entrada
        </button>
      </div>
      {showForm && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) resetEditor();
          }}
        >
          <div className="card stack modal-card">
        <div className="row">
          <strong>{editingOrderId ? "Editar entrada" : "Nueva entrada"}</strong>
          <button className="secondary" onClick={resetEditor}>
            Cerrar
          </button>
          <button
            className="secondary"
            onClick={() => setShowCsvImport((prev) => !prev)}
          >
            {showCsvImport ? "Ocultar importacion" : "Importar CSV"}
          </button>
        </div>
        <div className="row">
          <label className="stack">
            <span className="muted">ID entrada</span>
            <input
              className="input"
              placeholder="ID propio"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Proveedor</span>
            <select
              className="input"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
            >
              <option value="">Proveedor</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span className="muted">Estado</span>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="draft">Borrador</option>
              <option value="ordered">Pedido</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Notas</span>
            <input
              className="input"
              placeholder="Notas"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
        </div>
        <div className="card stack">
          <strong>Lineas</strong>
          {showCsvImport && (
            <>
              <CsvMappingWizard
                title="Importar CSV"
                fields={[
                  { key: "sku", label: "SKU", required: true },
                  { key: "productName", label: "Nombre del producto" },
                  { key: "manufacturerRef", label: "Ref fabricante" },
                  { key: "productType", label: "Tipo (standard/quick)" },
                  { key: "quantity", label: "Cantidad", required: true },
                  { key: "unitCost", label: "Coste unitario" },
                ]}
                onImport={handleCsvImport}
                onStatus={setCsvStatus}
              />
              {csvStatus && <p className="muted">{csvStatus}</p>}
            </>
          )}
          <div className="row">
            <label className="stack">
              <span className="muted">SKU del producto</span>
              <input
                className="input"
                placeholder="SKU del producto"
                value={lineDraft.sku}
                onChange={(e) => {
                  const sku = e.target.value;
                  const product = findProductBySku(sku);
                  const cost = product?.cost ? Number(product.cost) : "";
                  setLineDraft((prev) => ({
                    ...prev,
                    sku: product?.sku ?? sku.trim(),
                    productName: prev.productName || product?.name || "",
                    manufacturerRef:
                      prev.manufacturerRef || product?.manufacturerRef || "",
                    productType: prev.productType || product?.type || "standard",
                    unitCost: prev.unitCost || cost.toString(),
                  }));
                }}
              />
            </label>
            {selectedProduct && (
              <div className="purchase-product-preview">
                <div className="purchase-product-image">
                  {getProductImage(selectedProduct) ? (
                    <img
                      src={getProductImage(selectedProduct) ?? undefined}
                      alt={selectedProduct.name}
                    />
                  ) : (
                    <div className="product-placeholder">Sin imagen</div>
                  )}
                </div>
                <div className="purchase-product-body">
                  <strong>{selectedProduct.name}</strong>
                  <span className="muted">{selectedProduct.sku}</span>
                  {selectedProduct.manufacturerRef && (
                    <span className="muted">
                      Ref: {selectedProduct.manufacturerRef}
                    </span>
                  )}
                  {selectedProduct.color && (
                    <span className="muted">Color: {selectedProduct.color}</span>
                  )}
                </div>
              </div>
            )}
            <label className="stack">
              <span className="muted">Nombre del producto</span>
              <input
                className="input"
                placeholder="Nombre del producto"
                value={lineDraft.productName}
                onChange={(e) =>
                  setLineDraft({ ...lineDraft, productName: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Ref fabricante</span>
              <input
                className="input"
                placeholder="Ref fabricante"
                value={lineDraft.manufacturerRef}
                onChange={(e) =>
                  setLineDraft({ ...lineDraft, manufacturerRef: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Tipo de producto</span>
              <select
                className="input"
                value={lineDraft.productType}
                onChange={(e) =>
                  setLineDraft({
                    ...lineDraft,
                    productType: e.target.value as "standard" | "quick",
                  })
                }
              >
                <option value="standard">Estandar</option>
                <option value="quick">Quick</option>
              </select>
            </label>
            <label className="stack">
              <span className="muted">Cantidad</span>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="Cantidad"
                value={lineDraft.quantity}
                onChange={(e) =>
                  setLineDraft({
                    ...lineDraft,
                    quantity: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Precio de compra (coste)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Coste"
                value={lineDraft.unitCost}
                onChange={(e) =>
                  setLineDraft({ ...lineDraft, unitCost: e.target.value })
                }
              />
            </label>
            <button className="secondary" onClick={addLine}>
              Anadir
            </button>
          </div>
          <div className="row">
            <label className="stack">
              <span className="muted">Buscar producto</span>
              <input
                className="input"
                placeholder="Buscar producto"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </label>
          </div>
            {productSearch.trim() ? (
              <div className="purchase-product-grid">
                {filteredProducts.slice(0, 8).map((p) => (
                  <button
                  key={p.sku}
                  type="button"
                  className="purchase-product-card"
                  onClick={() => {
                    const cost = p.cost ? Number(p.cost) : "";
                    setLineDraft({
                      sku: p.sku,
                      productName: p.name || "",
                      manufacturerRef: p.manufacturerRef || "",
                      productType: p.type || "standard",
                      quantity: lineDraft.quantity,
                      unitCost: lineDraft.unitCost || cost.toString(),
                    });
                  }}
                >
                  <div className="purchase-product-image">
                    {getProductImage(p) ? (
                      <img src={getProductImage(p) ?? undefined} alt={p.name} />
                    ) : (
                      <div className="product-placeholder">Sin imagen</div>
                    )}
                  </div>
                  <div className="purchase-product-body">
                    <strong>{p.name || p.sku}</strong>
                    <span className="muted">{p.sku}</span>
                    {p.manufacturerRef && (
                      <span className="muted">Ref: {p.manufacturerRef}</span>
                    )}
                    {p.color && <span className="muted">Color: {p.color}</span>}
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="purchase-product-empty">
                  <span className="muted">
                    Sin resultados. Crea la ficha del producto primero.
                  </span>
                </div>
              )}
              {filteredProducts.length > 8 && (
                <div className="purchase-product-empty">
                  <span className="muted">
                    Mostrando 8 de {filteredProducts.length}. Refina la busqueda.
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="purchase-product-empty">
              <span className="muted">
                Escribe para buscar productos por SKU, nombre o ref.
              </span>
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Ref fabricante</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Coste</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.sku}-${index}`}>
                  <td>{line.sku}</td>
                  <td>{line.productName ?? "-"}</td>
                  <td>{line.manufacturerRef ?? "-"}</td>
                  <td>{line.productType ?? "standard"}</td>
                  <td>{line.quantity}</td>
                  <td>{line.unitCost ?? "-"}</td>
                  <td>
                    <button className="secondary" onClick={() => removeLine(index)}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Sin lineas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="row">
          <button onClick={createOrder}>
            {editingOrderId ? "Guardar cambios" : "Guardar entrada"}
          </button>
          {editingOrderId && (
            <button className="secondary" onClick={resetEditor}>
              Cancelar
            </button>
          )}
        </div>
        {status && <p className="muted">{status}</p>}
          </div>
        </div>
      )}

      <div className="card stack">
        <strong>Entradas registradas</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Almacen para recibir</span>
            <select
              className="input"
              value={receiveWarehouseId}
              onChange={(e) => setReceiveWarehouseId(e.target.value)}
            >
              <option value="">Almacen para recibir</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="stack">
            <span className="muted">Fecha recepcion</span>
            <input
              className="input"
              type="datetime-local"
              value={receiveDate}
              onChange={(e) => setReceiveDate(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Notas recepcion</span>
            <input
              className="input"
              placeholder="Notas recepcion"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
            />
          </label>
        </div>
        {status && <p className="muted">{status}</p>}
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Proveedor</th>
              <th>Estado</th>
              <th>Lineas</th>
              <th>Recibido</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.number}</td>
                <td>{o.supplier?.name ?? "-"}</td>
                <td>{o.status}</td>
                <td>{o.lines.length}</td>
                <td>
                  {o.receivedAt ? new Date(o.receivedAt).toLocaleString() : "-"}
                </td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditingOrderId(o.id);
                      setForm({
                        number: o.number ?? "",
                        supplierId: String(o.supplier?.id ?? ""),
                        status: o.status,
                        notes: "",
                      });
                      setLines(
                        o.lines.map((line) => ({
                          sku: line.sku,
                          productName: line.productName,
                          manufacturerRef: line.manufacturerRef,
                          productType: line.productType ?? "standard",
                          quantity: line.quantity,
                          unitCost:
                            typeof line.unitCost === "number"
                              ? line.unitCost
                              : line.unitCost
                              ? Number(line.unitCost)
                              : undefined,
                        }))
                      );
                      setShowForm(true);
                    }}
                  >
                    Editar
                  </button>
                  {o.status !== "received" && o.status !== "cancelled" && (
                    <button className="secondary" onClick={() => receiveOrder(o.id)}>
                      Recibir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin entradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
