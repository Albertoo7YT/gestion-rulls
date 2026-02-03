"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Supplier = {
  id: number;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    taxId: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    refresh().catch((err) => setStatus(err.message));
  }, []);

  async function refresh() {
    const data = await api.get<Supplier[]>("/suppliers");
    setSuppliers(data);
  }

  function resetForm() {
    setForm({ name: "", taxId: "", email: "", phone: "", notes: "" });
    setEditingId(null);
  }

  async function submit() {
    if (!form.name.trim()) {
      setStatus("El nombre es obligatorio.");
      return;
    }
    setStatus("Guardando proveedor...");
    const payload = {
      name: form.name.trim(),
      taxId: form.taxId.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    try {
      if (editingId) {
        await api.put(`/suppliers/${editingId}`, payload);
      } else {
        await api.post("/suppliers", payload);
      }
      await refresh();
      resetForm();
      setStatus("Proveedor guardado.");
    } catch (err: any) {
      setStatus(err?.message ?? "No se pudo guardar el proveedor.");
    }
  }

  async function removeSupplier(id: number) {
    if (!confirm("¿Eliminar proveedor?")) return;
    await api.del(`/suppliers/${id}`);
    await refresh();
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name ?? "",
      taxId: supplier.taxId ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      notes: supplier.notes ?? "",
    });
  }

  return (
    <div className="stack">
      <h2>Proveedores</h2>
      <div className="card stack">
        <strong>{editingId ? "Editar proveedor" : "Nuevo proveedor"}</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Nombre</span>
            <input
              className="input"
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">CIF/NIF</span>
            <input
              className="input"
              placeholder="CIF/NIF"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Email</span>
            <input
              className="input"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
        </div>
        <div className="row">
          <label className="stack">
            <span className="muted">Telefono</span>
            <input
              className="input"
              placeholder="Telefono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
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
        <div className="row">
          <button type="button" onClick={submit}>
            {editingId ? "Guardar" : "Crear"}
          </button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
        {status && <p className="muted">{status}</p>}
      </div>

      <div className="card stack">
        <strong>Listado</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>CIF/NIF</th>
              <th>Email</th>
              <th>Telefono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.taxId ?? "-"}</td>
                <td>{s.email ?? "-"}</td>
                <td>{s.phone ?? "-"}</td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => startEdit(s)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeSupplier(s.id)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin proveedores
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
