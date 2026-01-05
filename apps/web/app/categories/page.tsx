"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Category = { id: number; name: string };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const data = await api.get<Category[]>("/categories");
    setCategories(data);
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message));
  }, []);

  async function create() {
    setStatus(null);
    const value = name.trim();
    if (!value) return;
    await api.post("/categories", { name: value });
    setName("");
    await load();
  }

  async function remove(id: number) {
    const ok = window.confirm("Eliminar categoria?");
    if (!ok) return;
    await api.del(`/categories/${id}`);
    await load();
  }

  return (
    <div className="stack">
      <h2>Categorias</h2>
      <div className="card stack">
        <div className="row">
          <label className="stack">
            <span className="muted">Nombre categoria</span>
            <input
              className="input"
              placeholder="Nombre categoria"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="stack">
            <span className="muted">Accion</span>
            <button onClick={create}>Anadir</button>
          </label>
        </div>
      </div>
      <div className="card stack">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>
                  <button onClick={() => remove(c.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  Sin categorias
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
