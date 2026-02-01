"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "../../../lib/api";

type User = {
  id: number;
  email: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
  twoFactorEnabled?: boolean;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [otpToken, setOtpToken] = useState("");
  const [otpSecret, setOtpSecret] = useState<string | null>(null);
  const [otpUrl, setOtpUrl] = useState<string | null>(null);
  const [otpQr, setOtpQr] = useState<string | null>(null);

  async function loadMe() {
    const resp = await api.get<{ user: User | null }>("/auth/me");
    setMe(resp.user ?? null);
  }

  async function load() {
    setUsers(await api.get<User[]>("/users"));
  }

  useEffect(() => {
    Promise.all([load(), loadMe()]).catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (!otpUrl) {
      setOtpQr(null);
      return;
    }
    QRCode.toDataURL(otpUrl)
      .then((dataUrl: string) => setOtpQr(dataUrl))
      .catch(() => setOtpQr(null));
  }, [otpUrl]);

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

  async function setupTwoFactor() {
    setStatus(null);
    const result = await api.post<{ secret: string; otpauthUrl: string }>(
      "/auth/2fa/setup",
    );
    setOtpSecret(result.secret);
    setOtpUrl(result.otpauthUrl);
  }

  async function enableTwoFactor() {
    if (!otpToken) return;
    setStatus(null);
    await api.post("/auth/2fa/enable", { token: otpToken });
    setOtpToken("");
    await loadMe();
  }

  async function disableTwoFactor() {
    if (!otpToken) return;
    setStatus(null);
    await api.post("/auth/2fa/disable", { token: otpToken });
    setOtpToken("");
    setOtpSecret(null);
    setOtpUrl(null);
    await loadMe();
  }

  return (
    <div className="stack">
      <h2>Usuarios</h2>
      <div className="row">
        <a className="button secondary" href="/settings/audit">
          Ver log
        </a>
      </div>
      <div className="card stack">
        <strong>Seguridad 2FA</strong>
        <p className="muted">
          Estado: {me?.twoFactorEnabled ? "Activado" : "Desactivado"}
        </p>
        <div className="row">
          <button className="secondary" onClick={setupTwoFactor}>
            Generar codigo
          </button>
          <label className="stack">
            <span className="muted">Codigo 2FA</span>
            <input
              className="input"
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value)}
              placeholder="123456"
            />
          </label>
          {!me?.twoFactorEnabled ? (
            <button onClick={enableTwoFactor}>Activar 2FA</button>
          ) : (
            <button className="secondary" onClick={disableTwoFactor}>
              Desactivar 2FA
            </button>
          )}
        </div>
        {otpSecret && (
          <div className="stack">
            <span className="muted">Secreto (para Authenticator):</span>
            <code>{otpSecret}</code>
            {otpUrl && (
              <>
                <span className="muted">OTPAUTH URL:</span>
                <code>{otpUrl}</code>
              </>
            )}
            {otpQr && (
              <img
                src={otpQr}
                alt="QR 2FA"
                style={{ width: 180, height: 180, borderRadius: 12 }}
              />
            )}
          </div>
        )}
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
