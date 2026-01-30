"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type LocationType = "warehouse";

type Location = {
  id: number;
  type: LocationType;
  name: string;
  city: string;
  active: boolean;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  postalCode?: string | null;
  province?: string | null;
  country?: string | null;
  phone?: string | null;
  contactName?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
};

const emptyForm: Omit<Location, "id" | "active"> & { active?: boolean } = {
  type: "warehouse",
  name: "",
  city: "",
  legalName: "",
  taxId: "",
  address: "",
  postalCode: "",
  province: "",
  country: "",
  phone: "",
  contactName: "",
  email: "",
  paymentTerms: "",
  notes: "",
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [filter, setFilter] = useState<LocationType | "all">("all");
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadLocations() {
    const query = filter === "all" ? "" : `?type=${filter}`;
    const data = await api.get<Location[]>(`/locations${query}`);
    setLocations(data.filter((loc) => loc.type === "warehouse"));
  }

  useEffect(() => {
    loadLocations().catch((err) => setStatus(err.message));
  }, [filter]);

  async function createLocation() {
    setStatus(null);
    await api.post("/locations", {
      ...form,
      active: form.active ?? true,
      legalName: form.legalName || null,
      taxId: form.taxId || null,
      address: form.address || null,
      postalCode: form.postalCode || null,
      province: form.province || null,
      country: form.country || null,
      phone: form.phone || null,
      contactName: form.contactName || null,
      email: form.email || null,
      paymentTerms: form.paymentTerms || null,
      notes: form.notes || null,
    });
    setForm(emptyForm);
    await loadLocations();
  }

  async function saveEdit() {
    if (!editing) return;
    setStatus(null);
    const { id, ...payload } = editing;
    await api.put(`/locations/${id}`, payload);
    setEditing(null);
    await loadLocations();
  }

  return (
    <div className="stack">
      <h2>Almacenes</h2>

      <div className="card stack">
        <button onClick={() => setShowCreate((prev) => !prev)}>
          {showCreate ? "Ocultar" : "Anadir almacen"}
        </button>
      </div>

      {showCreate && (
        <div className="card stack">
          <strong>Crear almacen</strong>
          <div className="row">
            <label className="stack">
              <span className="muted">Tipo</span>
              <select
                className="input"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as LocationType })
                }
              >
                <option value="warehouse">Almacen</option>
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
              <span className="muted">Ciudad</span>
              <input
                className="input"
                placeholder="Ciudad"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <button onClick={createLocation}>Crear</button>
          </div>
        </div>
      )}

      <div className="card stack">
        <div className="row">
          <label className="stack">
            <span className="muted">Filtro tipo</span>
            <select
              className="input"
              value={filter}
              onChange={(e) => setFilter(e.target.value as LocationType | "all")}
            >
              <option value="all">Todas</option>
              <option value="warehouse">Almacen</option>
            </select>
          </label>
          <button className="secondary" onClick={loadLocations}>
            Refrescar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tipo</th>
              <th>Nombre</th>
              <th>Ciudad</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {locations.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>Almacen</td>
                <td>
                  <a href={`/stock?locationId=${l.id}`}>{l.name}</a>
                </td>
                <td>{l.city}</td>
                <td>{l.active ? "Si" : "No"}</td>
                <td className="row">
                  <button className="secondary" onClick={() => setEditing(l)}>
                    Editar
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => {
                      const confirmDelete = window.confirm(
                        `Seguro que quieres eliminar ${l.name}?`,
                      );
                      if (!confirmDelete) return;
                      setStatus(null);
                      api
                        .del(`/locations/${l.id}`)
                        .then(loadLocations)
                        .catch((err) => setStatus(err.message));
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {locations.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin locations
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card stack">
          <strong>Editar {editing.name}</strong>
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
              <span className="muted">Ciudad</span>
              <input
                className="input"
                value={editing.city}
                onChange={(e) =>
                  setEditing({ ...editing, city: e.target.value })
                }
                placeholder="Ciudad"
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
            <button onClick={saveEdit}>Guardar</button>
            <button className="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
