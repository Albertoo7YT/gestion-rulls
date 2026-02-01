"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type Category = { id: number; name: string };
type Supplier = { id: number; name: string };
type PriceRule = {
  id: number;
  name: string;
  target: "public" | "b2b";
  scope: "all" | "category" | "supplier";
  type: "percent" | "fixed";
  value: number;
  priority: number;
  active: boolean;
  category?: { id: number; name: string } | null;
  supplier?: { id: number; name: string } | null;
};

type PricingForm = {
  name: string;
  target: "public" | "b2b";
  scope: "all" | "category" | "supplier";
  type: "percent" | "fixed";
  value: string;
  priority: string;
  active: boolean;
  categoryId: string;
  supplierId: string;
};

const emptyForm: PricingForm = {
  name: "",
  target: "public",
  scope: "all",
  type: "percent",
  value: "",
  priority: "100",
  active: true,
  categoryId: "",
  supplierId: "",
};

export default function PricingSettingsPage() {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [status, setStatus] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadAll() {
    const [rulesData, categoryData, supplierData] = await Promise.all([
      api.get<PriceRule[]>("/pricing/rules"),
      api.get<Category[]>("/categories"),
      api.get<Supplier[]>("/suppliers"),
    ]);
    setRules(rulesData);
    setCategories(categoryData);
    setSuppliers(supplierData);
  }

  useEffect(() => {
    loadAll().catch((err) => setStatus(err.message));
  }, []);

  function startEdit(rule: PriceRule) {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      target: rule.target,
      scope: rule.scope,
      type: rule.type,
      value: String(rule.value ?? ""),
      priority: String(rule.priority ?? 100),
      active: rule.active,
      categoryId: rule.category?.id ? String(rule.category.id) : "",
      supplierId: rule.supplier?.id ? String(rule.supplier.id) : "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  async function saveRule() {
    setStatus(null);
    if (!form.name.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    const value = Number(form.value);
    if (Number.isNaN(value)) {
      setStatus("El valor debe ser numerico.");
      return;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      target: form.target,
      scope: form.scope,
      type: form.type,
      value,
      priority: Number(form.priority) || 100,
      active: form.active,
    };
    if (form.scope === "category") {
      payload.categoryId = Number(form.categoryId) || undefined;
    }
    if (form.scope === "supplier") {
      payload.supplierId = Number(form.supplierId) || undefined;
    }
    if (editingId) {
      await api.put(`/pricing/rules/${editingId}`, payload);
    } else {
      await api.post("/pricing/rules", payload);
    }
    resetForm();
    await loadAll();
  }

  async function removeRule(id: number) {
    const ok = window.confirm("Eliminar esta plantilla?");
    if (!ok) return;
    await api.del(`/pricing/rules/${id}`);
    await loadAll();
  }

  return (
    <div className="stack">
      <h2>Plantillas de precios</h2>
      <div className="card stack">
        <div className="row">
          <label className="stack">
            <span className="muted">Nombre</span>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Tarifa</span>
            <select
              className="input"
              value={form.target}
              onChange={(e) =>
                setForm({
                  ...form,
                  target: e.target.value as "public" | "b2b",
                })
              }
            >
              <option value="public">Publico</option>
              <option value="b2b">B2B</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Alcance</span>
            <select
              className="input"
              value={form.scope}
              onChange={(e) =>
                setForm({
                  ...form,
                  scope: e.target.value as "all" | "category" | "supplier",
                })
              }
            >
              <option value="all">Todos</option>
              <option value="category">Categoria</option>
              <option value="supplier">Proveedor</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Tipo</span>
            <select
              className="input"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as "percent" | "fixed",
                })
              }
            >
              <option value="percent">% descuento</option>
              <option value="fixed">Precio fijo</option>
            </select>
          </label>
        </div>
        <div className="row">
          <label className="stack">
            <span className="muted">
              {form.type === "percent" ? "Porcentaje" : "Precio"}
            </span>
            <input
              className="input"
              type="number"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Prioridad</span>
            <input
              className="input"
              type="number"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Activo</span>
            <div className="row">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              <span className="muted">Aplicar</span>
            </div>
          </label>
          {form.scope === "category" && (
            <label className="stack">
              <span className="muted">Categoria</span>
              <select
                className="input"
                value={form.categoryId}
                onChange={(e) =>
                  setForm({ ...form, categoryId: e.target.value })
                }
              >
                <option value="">Selecciona</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.scope === "supplier" && (
            <label className="stack">
              <span className="muted">Proveedor</span>
              <select
                className="input"
                value={form.supplierId}
                onChange={(e) =>
                  setForm({ ...form, supplierId: e.target.value })
                }
              >
                <option value="">Selecciona</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <div className="row">
          <button onClick={saveRule}>
            {editingId ? "Guardar cambios" : "Crear plantilla"}
          </button>
          {editingId && (
            <button className="secondary" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
        {status && <p className="muted">{status}</p>}
      </div>
      <div className="card stack">
        <strong>Plantillas activas</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tarifa</th>
              <th>Alcance</th>
              <th>Valor</th>
              <th>Prioridad</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td>{rule.name}</td>
                <td>{rule.target}</td>
                <td>
                  {rule.scope}
                  {rule.scope === "category" && rule.category
                    ? ` (${rule.category.name})`
                    : ""}
                  {rule.scope === "supplier" && rule.supplier
                    ? ` (${rule.supplier.name})`
                    : ""}
                </td>
                <td>
                  {rule.type === "percent" ? `${rule.value}%` : rule.value}
                </td>
                <td>{rule.priority}</td>
                <td>{rule.active ? "Si" : "No"}</td>
                <td className="row">
                  <button
                    className="secondary"
                    onClick={() => startEdit(rule)}
                  >
                    Editar
                  </button>
                  <button
                    className="danger"
                    onClick={() => removeRule(rule.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Sin plantillas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
