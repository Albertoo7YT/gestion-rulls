"use client";

import { FormEvent, useState } from "react";
import { api } from "../../lib/api";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const result = await api.post<{
        accessToken: string;
        user: {
          id: number;
          email: string;
          username: string;
          role: string;
          twoFactorEnabled?: boolean;
        };
      }>("/auth/login", {
        identifier,
        password,
        otp: otp || undefined,
      });
      localStorage.setItem("auth_token", result.accessToken);
      localStorage.setItem("auth_user", JSON.stringify(result.user));
      window.location.href = "/";
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      let message = raw;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.message) {
          message = Array.isArray(parsed.message)
            ? parsed.message.join(", ")
            : String(parsed.message);
        }
      } catch {
        // keep raw text
      }
      setStatus(message);
      const lower = message.toLowerCase();
      if (lower.includes("two-factor") || lower.includes("2fa") || lower.includes("otp")) {
        setShowOtp(true);
      }
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
        {(showOtp || otp) && (
          <label className="stack">
            <span className="muted">Codigo 2FA</span>
            <input
              className="input"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="codigo 2FA"
              autoComplete="one-time-code"
            />
          </label>
        )}
        <button disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      {status && <p className="inline-error">{status}</p>}
    </div>
  );
}
