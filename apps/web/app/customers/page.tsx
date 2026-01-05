"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Customer = {
  id: number;
  type: "b2b" | "public";
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  active: boolean;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "b2b" | "public">(
    "all",
  );
  const [form, setForm] = useState({
    type: "b2b" as "b2b" | "public",
    name: "",
    taxId: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [editing, setEditing] = useState<Customer | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const query =
      typeFilter === "all" ? "" : `?type=${typeFilter}&search=${search}`;
    const data = await api.get<Customer[]>(`/customers${query}`);
    setCustomers(data);
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message));
  }, [typeFilter]);

  async function create() {
    setStatus(null);
    if (!form.name.trim()) return;
    await api.post("/customers", {
      type: form.type,
      name: form.name.trim(),
      taxId: form.taxId.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    setForm({
      type: "b2b",
      name: "",
      taxId: "",
      email: "",
      phone: "",
      notes: "",
    });
    await load();
  }

  async function remove(id: number) {
    const ok = window.confirm("Eliminar cliente?");
    if (!ok) return;
    await api.del(`/customers/${id}`);
    await load();
  }

  async function saveEdit() {
    if (!editing) return;
    await api.put(`/customers/${editing.id}`, {
      type: editing.type,
      name: editing.name,
      taxId: editing.taxId || undefined,
      email: editing.email || undefined,
      phone: editing.phone || undefined,
      notes: editing.notes || undefined,
    });
    setEditing(null);
    await load();
  }

  return (
    <div className="stack">
      <h2>Clientes</h2>
      <div className="card stack">
        <strong>Nuevo cliente</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Tipo</span>
            <select
              className="input"
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as "b2b" | "public" })
              }
            >
              <option value="b2b">B2B</option>
              <option value="public">Publico</option>
            </select>
          </label>
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
            <span className="muted">Tax ID</span>
            <input
              className="input"
              placeholder="Tax ID"
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
            <span className="muted">Accion</span>
            <button onClick={create}>Crear</button>
          </label>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <label className="stack">
            <span className="muted">Buscar cliente</span>
            <input
              className="input"
              placeholder="Buscar cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Filtro tipo</span>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | "b2b" | "public")
              }
            >
              <option value="all">Todos</option>
              <option value="b2b">B2B</option>
              <option value="public">Publico</option>
            </select>
          </label>
          <button className="secondary" onClick={load}>
            Buscar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Telefono</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.type}</td>
                <td>{c.name}</td>
                <td>{c.email ?? "-"}</td>
                <td>{c.phone ?? "-"}</td>
                <td>
                  <div className="row">
                    <button className="secondary" onClick={() => setEditing(c)}>
                      Editar
                    </button>
                    <button onClick={() => remove(c.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin clientes
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {status && <p className="muted">{status}</p>}
      {editing && (
        <div className="card stack">
          <strong>Editar cliente #{editing.id}</strong>
          <div className="row">
            <label className="stack">
              <span className="muted">Tipo</span>
              <select
                className="input"
                value={editing.type}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    type: e.target.value as "b2b" | "public",
                  })
                }
              >
                <option value="b2b">B2B</option>
                <option value="public">Publico</option>
              </select>
            </label>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                placeholder="Nombre"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Tax ID</span>
              <input
                className="input"
                placeholder="Tax ID"
                value={editing.taxId ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, taxId: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Email</span>
              <input
                className="input"
                placeholder="Email"
                value={editing.email ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, email: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Telefono</span>
              <input
                className="input"
                placeholder="Telefono"
                value={editing.phone ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, phone: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Notas</span>
              <input
                className="input"
                placeholder="Notas"
                value={editing.notes ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </label>
          </div>
          <div className="row">
            <button onClick={saveEdit}>Guardar</button>
            <button className="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
