"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function SettingsPage() {
  const [methods, setMethods] = useState<{ id: number; name: string }[]>([]);
  const [newMethod, setNewMethod] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "restore">("merge");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backups, setBackups] = useState<
    { name: string; size: number; createdAt: string }[]
  >([]);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";

  function getAuthHeader() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadMethods() {
    const data = await api.get<{ id: number; name: string }[]>(
      "/payment-methods",
    );
    setMethods(data);
  }

  useEffect(() => {
    loadMethods().catch((err) => setStatus(err.message));
    api
      .get<{ name: string; size: number; createdAt: string }[]>("/backup/list")
      .then(setBackups)
      .catch(() => null);
  }, []);

  async function addMethod() {
    if (!newMethod.trim()) return;
    try {
      await api.post("/payment-methods", { name: newMethod.trim() });
      setStatus(null);
    } catch (err) {
      setStatus(String(err));
      return;
    }
    setNewMethod("");
    await loadMethods();
  }

  async function removeMethod(id: number) {
    const ok = window.confirm("¿Eliminar metodo de pago?");
    if (!ok) return;
    await api.del(`/payment-methods/${id}`);
    await loadMethods();
  }

  async function runImport() {
    if (!importFile) {
      setImportStatus("Selecciona un archivo ZIP primero.");
      return;
    }
    setImportStatus(null);
    const form = new FormData();
    form.append("file", importFile);
    try {
      const res = await fetch(
        `${apiBase}/import?mode=${importMode}`,
        {
          method: "POST",
          body: form,
          headers: {
            ...getAuthHeader(),
          },
        },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      setImportStatus("Importacion completada.");
    } catch (err) {
      setImportStatus(String(err));
    }
  }

  async function downloadFile(url: string, filename: string) {
    try {
      const res = await fetch(url, {
        headers: {
          ...getAuthHeader(),
        },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setBackupStatus(String(err));
    }
  }

  async function runBackup() {
    setBackupStatus(null);
    try {
      const res = await api.post<{ name: string }>("/backup/run");
      setBackupStatus(`Backup creado: ${res.name}`);
      const list = await api.get<
        { name: string; size: number; createdAt: string }[]
      >("/backup/list");
      setBackups(list);
    } catch (err) {
      setBackupStatus(String(err));
    }
  }

  return (
    <div className="stack">
      <h2>Ajustes</h2>
      <div className="card stack">
        <strong>Integraciones</strong>
        <div className="row">
          <a className="card highlight" href="/settings/woo">
            Woo Settings
          </a>
          <a className="card highlight" href="/settings/pricing">
            Plantillas de precios
          </a>
          <a className="card highlight" href="/settings/users">
            Usuarios
          </a>
          <a className="card highlight" href="/settings/audit">
            Historial
          </a>
        </div>
      </div>
      <div className="card stack">
        <strong>Metodos de pago</strong>
        <div className="row">
          <label className="stack">
            <span className="muted">Nuevo metodo</span>
            <input
              className="input"
              placeholder="Nuevo metodo"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
            />
          </label>
          <button onClick={addMethod}>Anadir</button>
        </div>
        <div className="row">
          {methods.map((m) => (
            <button
              key={m.id}
              className="secondary"
              onClick={() => removeMethod(m.id)}
            >
              {m.name}
            </button>
          ))}
        </div>
        {status && <p className="muted">{status}</p>}
      </div>
      <div className="card stack">
        <strong>Importar / Exportar</strong>
        <p className="muted">
          Exporta un ZIP con todos los datos o importa uno para restaurar o
          fusionar.
        </p>
        <div className="row">
          <button
            className="button"
            onClick={() => downloadFile(`${apiBase}/export`, "export.zip")}
          >
            Exportar ZIP
          </button>
          <button className="secondary" onClick={runBackup}>
            Backup ahora
          </button>
        </div>
        {backupStatus && <p className="muted">{backupStatus}</p>}
        {backups.length > 0 && (
          <div className="stack">
            <span className="muted">Ultimos backups</span>
            <div className="row">
              {backups.slice(0, 3).map((b) => (
                <button
                  key={b.name}
                  className="secondary"
                  onClick={() =>
                    downloadFile(`${apiBase}/backup/download/${b.name}`, b.name)
                  }
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="row">
          <label className="stack">
            <span className="muted">Modo importacion</span>
            <select
              className="input"
              value={importMode}
              onChange={(e) =>
                setImportMode(e.target.value as "merge" | "restore")
              }
            >
              <option value="merge">Fusionar (merge)</option>
              <option value="restore">Restaurar (borra todo)</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Archivo ZIP</span>
            <input
              className="input"
              type="file"
              accept=".zip"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button className="secondary" onClick={runImport}>
            Importar ZIP
          </button>
        </div>
        {importStatus && <p className="muted">{importStatus}</p>}
      </div>
    </div>
  );
}
