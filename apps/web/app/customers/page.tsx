"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

type Customer = {
  id: number;
  type: "b2b" | "public" | "b2c";
  name: string;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  province?: string | null;
  email?: string | null;
  city?: string | null;
  country?: string | null;
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
    addressLine1: "",
    addressLine2: "",
    postalCode: "",
    province: "",
    city: "",
    country: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [editing, setEditing] = useState<Customer | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const typeLabel = (type: Customer["type"]) =>
    type === "b2b" ? "B2B" : "Publico";

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
      addressLine1: form.addressLine1.trim() || undefined,
      addressLine2: form.addressLine2.trim() || undefined,
      postalCode: form.postalCode.trim() || undefined,
      province: form.province.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    setForm({
      type: "b2b",
      name: "",
      taxId: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      province: "",
      city: "",
      country: "",
      email: "",
      phone: "",
      notes: "",
    });
    setCreateOpen(false);
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
      addressLine1: editing.addressLine1 || undefined,
      addressLine2: editing.addressLine2 || undefined,
      postalCode: editing.postalCode || undefined,
      province: editing.province || undefined,
      city: editing.city || undefined,
      country: editing.country || undefined,
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
      <div className="card row row-space">
        <strong>Listado de clientes</strong>
        <button className="secondary" onClick={() => setCreateOpen(true)}>
          Nuevo cliente
        </button>
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
                <td>{typeLabel(c.type)}</td>
                <td>
                  <Link className="link-button" href={`/crm/customers/${c.id}`}>
                    {c.name}
                  </Link>
                </td>
                <td>{c.email ?? "-"}</td>
                <td>{c.phone ?? "-"}</td>
                <td>
                  <div className="row">
                    <Link className="secondary" href={`/crm/customers/${c.id}`}>
                      Ficha
                    </Link>
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
      {createOpen && (
        <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
          <div
            className="card modal-card stack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row row-space">
              <strong>Nuevo cliente</strong>
              <button className="secondary" onClick={() => setCreateOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Tipo</span>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      type: e.target.value as "b2b" | "public",
                    })
                  }
                >
                  <option value="b2b">B2B</option>
                  <option value="public">Publico</option>
                </select>
              </label>
              <label className="stack">
                <span className="muted">Nombre *</span>
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
                <span className="muted">Direccion</span>
                <input
                  className="input"
                  placeholder="Direccion"
                  value={form.addressLine1}
                  onChange={(e) =>
                    setForm({ ...form, addressLine1: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Direccion 2</span>
                <input
                  className="input"
                  placeholder="Direccion 2"
                  value={form.addressLine2}
                  onChange={(e) =>
                    setForm({ ...form, addressLine2: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">CP</span>
                <input
                  className="input"
                  placeholder="Codigo postal"
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Provincia</span>
                <input
                  className="input"
                  placeholder="Provincia"
                  value={form.province}
                  onChange={(e) =>
                    setForm({ ...form, province: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Ciudad</span>
                <input
                  className="input"
                  placeholder="Ciudad"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </label>
              <label className="stack">
                <span className="muted">Pais</span>
                <input
                  className="input"
                  placeholder="Pais"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
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
                <span className="muted">Notas</span>
                <input
                  className="input"
                  placeholder="Notas"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="row center-actions">
              <button onClick={create}>Crear</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div
            className="card modal-card stack"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row row-space">
              <strong>Editar cliente #{editing.id}</strong>
              <button className="secondary" onClick={() => setEditing(null)}>
                Cerrar
              </button>
            </div>
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
                <span className="muted">Direccion</span>
                <input
                  className="input"
                  placeholder="Direccion"
                  value={editing.addressLine1 ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, addressLine1: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Direccion 2</span>
                <input
                  className="input"
                  placeholder="Direccion 2"
                  value={editing.addressLine2 ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, addressLine2: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">CP</span>
                <input
                  className="input"
                  placeholder="Codigo postal"
                  value={editing.postalCode ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, postalCode: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Provincia</span>
                <input
                  className="input"
                  placeholder="Provincia"
                  value={editing.province ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, province: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Ciudad</span>
                <input
                  className="input"
                  placeholder="Ciudad"
                  value={editing.city ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, city: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Pais</span>
                <input
                  className="input"
                  placeholder="Pais"
                  value={editing.country ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, country: e.target.value })
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
            <div className="row center-actions">
              <button onClick={saveEdit}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
