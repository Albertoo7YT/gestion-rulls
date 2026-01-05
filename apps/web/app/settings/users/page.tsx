"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type User = {
  id: number;
  email: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    password: "",
  });

  async function load() {
    setUsers(await api.get<User[]>("/users"));
  }

  useEffect(() => {
    load().catch((err) => setStatus(err.message));
  }, []);

  async function createUser() {
    setStatus(null);
    await api.post("/users", {
      email: form.email,
      username: form.username,
      password: form.password,
      role: "admin",
    });
    setForm({ email: "", username: "", password: "" });
    await load();
  }

  async function toggleActive(user: User) {
    setStatus(null);
    await api.put(`/users/${user.id}`, { active: !user.active });
    await load();
  }

  async function resetPassword(user: User) {
    const nextPassword = window.prompt(
      `Nueva contrasena para ${user.username}`,
    );
    if (!nextPassword) return;
    setStatus(null);
    await api.put(`/users/${user.id}`, { password: nextPassword });
    await load();
  }

  return (
    <div className="stack">
      <h2>Usuarios</h2>
      <div className="card stack">
        <strong>Crear usuario</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Email</span>
            <input
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Usuario</span>
            <input
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </label>
          <label className="stack">
            <span className="muted">Contrasena</span>
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button onClick={createUser}>Crear</button>
        </div>
      </div>

      <div className="card stack">
        <strong>Usuarios registrados</strong>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.email}</td>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{user.active ? "Si" : "No"}</td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => resetPassword(user)}
                  >
                    Reset pass
                  </button>{" "}
                  <button
                    className="secondary"
                    onClick={() => toggleActive(user)}
                  >
                    {user.active ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin usuarios
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
