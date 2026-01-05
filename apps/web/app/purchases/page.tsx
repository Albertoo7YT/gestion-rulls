"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type Supplier = { id: number; name: string };

type Product = {
  sku: string;
  name: string;
  type?: "standard" | "quick";
  cost?: string | null;
  manufacturerRef?: string | null;
  photoUrl?: string | null;
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

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) =>
      `${p.sku} ${p.name} ${p.manufacturerRef ?? ""} ${p.color ?? ""}`
        .toLowerCase()
        .includes(term),
    );
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

  function parseCsvLines(text: string) {
    const rows = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => line.split(",").map((cell) => cell.trim()));

    if (!rows.length) return [];
    const header = rows[0].map((cell) => cell.toLowerCase());
    const hasHeader = header.includes("sku");
    const startIndex = hasHeader ? 1 : 0;

    const parsed: PurchaseOrderLine[] = [];
    for (const row of rows.slice(startIndex)) {
      const [
        sku,
        productName,
        manufacturerRef,
        productType,
        quantity,
        unitCost,
      ] = row;

      if (!sku) continue;
      const qty = Number(quantity || 1);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const cost = unitCost ? Number(unitCost) : undefined;
      parsed.push({
        sku,
        productName: productName || undefined,
        manufacturerRef: manufacturerRef || undefined,
        productType: productType === "quick" ? "quick" : "standard",
        quantity: qty,
        unitCost: Number.isFinite(cost) ? cost : undefined,
      });
    }

    return parsed;
  }

  async function handleCsvImport(file: File) {
    try {
      const text = await file.text();
      const parsed = parseCsvLines(text);
      if (!parsed.length) {
        setCsvStatus("No se encontraron lineas validas en el CSV.");
        return;
      }
      setLines((prev) => [...prev, ...parsed]);
      setCsvStatus(`Importadas ${parsed.length} lineas.`);
    } catch (err) {
      setCsvStatus("No se pudo leer el CSV.");
    }
  }

  function addLine() {
    if (!lineDraft.sku) {
      setStatus("Selecciona un producto.");
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
        sku: lineDraft.sku,
        productName: lineDraft.productName || undefined,
        manufacturerRef: lineDraft.manufacturerRef || undefined,
        productType: lineDraft.productType,
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
        <button onClick={openNewEntry}>Nueva entrada</button>
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
              <div className="row">
                <label className="stack">
                  <span className="muted">Importar CSV</span>
                  <input
                    className="input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      handleCsvImport(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <span className="muted">
                  Formato: sku,productName,manufacturerRef,productType,quantity,unitCost
                </span>
              </div>
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
                  const sku = e.target.value.trim();
                  const product = products.find((p) => p.sku === sku);
                  const cost = product?.cost ? Number(product.cost) : "";
                  setLineDraft({
                    ...lineDraft,
                    sku,
                    productName: lineDraft.productName || product?.name || "",
                    manufacturerRef:
                      lineDraft.manufacturerRef || product?.manufacturerRef || "",
                    productType: lineDraft.productType || product?.type || "standard",
                    unitCost: lineDraft.unitCost || cost.toString(),
                  });
                }}
              />
            </label>
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
          <div className="purchase-product-grid">
            {filteredProducts.map((p) => (
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
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} />
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
                <span className="muted">Sin resultados</span>
                {productSearch.trim() && (
                  <button
                    className="secondary"
                    type="button"
                    onClick={() =>
                      setLineDraft({
                        ...lineDraft,
                        sku: productSearch.trim(),
                        productName: lineDraft.productName || "",
                        manufacturerRef: lineDraft.manufacturerRef || "",
                        productType: lineDraft.productType || "standard",
                      })
                    }
                  >
                    Anadir SKU {productSearch.trim()}
                  </button>
                )}
              </div>
            )}
          </div>
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
