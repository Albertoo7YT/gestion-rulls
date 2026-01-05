"use client";

import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const result = await api.post<{
        accessToken: string;
        user: { id: number; email: string; username: string; role: string };
      }>("/auth/login", {
        identifier,
        password,
      });
      localStorage.setItem("auth_token", result.accessToken);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      window.location.href = "/";
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <h2>Acceso</h2>
      <p className="muted">Introduce tu usuario o email y contrasena.</p>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="stack">
          <span className="muted">Usuario o email</span>
          <input
            className="input"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="usuario o email"
            autoComplete="username"
          />
        </label>
        <label className="stack">
          <span className="muted">Contrasena</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="contrasena"
            autoComplete="current-password"
          />
        </label>
        <button disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      {status && <p className="inline-error">{status}</p>}
    </div>
  );
}
