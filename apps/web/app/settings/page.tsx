"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function SettingsPage() {
  type FiscalSettings = {
    issuerName?: string | null;
    issuerTaxId?: string | null;
    issuerAddressLine1?: string | null;
    issuerAddressLine2?: string | null;
    issuerPostalCode?: string | null;
    issuerCity?: string | null;
    issuerProvince?: string | null;
    issuerCountry?: string | null;
    issuerEmail?: string | null;
    issuerPhone?: string | null;
  };
  const [methods, setMethods] = useState<{ id: number; name: string }[]>([]);
  const [newMethod, setNewMethod] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [fiscal, setFiscal] = useState<FiscalSettings | null>(null);
  const [fiscalStatus, setFiscalStatus] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "restore">("merge");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importRunning, setImportRunning] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [backups, setBackups] = useState<
    { name: string; size: number; createdAt: string }[]
  >([]);
  const [purgeTargets, setPurgeTargets] = useState<string[]>([]);
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";

  function getAuthHeader() {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }

  async function loadMethods() {
    const data = await api.get<{ id: number; name: string }[]>(
      "/payment-methods",
    );
    setMethods(data);
  }

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
    loadMethods().catch((err) => setStatus(err.message));
    api
      .get<{ name: string; size: number; createdAt: string }[]>("/backup/list")
      .then(setBackups)
      .catch(() => null);
    api
      .get<FiscalSettings>("/settings/fiscal")
      .then(setFiscal)
      .catch(() => null);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
  }

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
    setImportStatus("Importando... (esto puede tardar)");
    setImportRunning(true);
    const form = new FormData();
    form.append("file", importFile);
    try {
      const res = await fetch(`${apiBase}/import?mode=${importMode}`, {
        method: "POST",
        body: form,
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      setImportStatus("Importacion completada.");
    } catch (err) {
      setImportStatus(String(err));
    } finally {
      setImportRunning(false);
    }
  }

  async function downloadFile(url: string, filename: string) {
    try {
      const res = await fetch(url, {
        headers: getAuthHeader(),
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

  async function saveFiscal() {
    if (!fiscal) return;
    setFiscalStatus(null);
    try {
      const updated = await api.put<FiscalSettings>("/settings/fiscal", fiscal);
      setFiscal(updated);
      setFiscalStatus("Datos fiscales guardados.");
    } catch (err) {
      setFiscalStatus(String(err));
    }
  }

  const purgeOptions = [
    { key: "customers", label: "Clientes" },
    { key: "products", label: "Productos" },
    { key: "categories", label: "Categorias" },
    { key: "suppliers", label: "Proveedores" },
    { key: "purchase_orders", label: "Entradas (pedidos compra)" },
    { key: "stock_moves", label: "Movimientos de stock / ventas" },
    { key: "web_orders", label: "Pedidos web" },
    { key: "accessories", label: "Accesorios" },
    { key: "price_rules", label: "Reglas de precios" },
    { key: "payment_methods", label: "Metodos de pago" },
    { key: "document_series", label: "Series" },
    { key: "locations", label: "Almacenes" },
    { key: "crm", label: "CRM (fases, tareas, notas)" },
    { key: "cash_closures", label: "Cierres de caja" },
    { key: "audit_logs", label: "Logs/Auditoria" },
    { key: "users", label: "Usuarios (login)" },
    { key: "settings", label: "Ajustes (Woo/Fiscal)" },
  ];

  function togglePurgeTarget(key: string) {
    setPurgeTargets((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function selectAllPurgeTargets() {
    setPurgeTargets(purgeOptions.map((opt) => opt.key));
  }

  function clearPurgeTargets() {
    setPurgeTargets([]);
  }

  async function runPurge() {
    setPurgeStatus(null);
    if (purgeTargets.length === 0) {
      setPurgeStatus("Selecciona al menos un bloque para borrar.");
      return;
    }
    const first = window.confirm(
      "Esta accion borrara datos seleccionados y no se puede deshacer. ¿Seguro?",
    );
    if (!first) return;
    const second = window.confirm(
      "Ultima advertencia. Esta accion es irreversible. ¿Continuar?",
    );
    if (!second) return;
    const third = window.confirm(
      "Confirmacion final: ¿Borrar los datos seleccionados ahora?",
    );
    if (!third) return;

    try {
      const res = await api.post<{ deleted: string[] }>("/settings/purge", {
        targets: purgeTargets,
      });
      setPurgeStatus(
        res.deleted.length > 0
          ? `Borrado completado: ${res.deleted.join(", ")}`
          : "No se borro nada.",
      );
    } catch (err) {
      setPurgeStatus(String(err));
    }
  }

  return (
    <div className="stack">
      <h2>Ajustes</h2>

      <div className="card stack">
        <div className="section-title">Tema</div>
        <div className="row">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            type="button"
          >
            <span className="moon-icon" />
          </button>
          <span className="muted">
            {theme === "dark" ? "Oscuro" : "Claro"}
          </span>
        </div>
      </div>
      <div className="card stack">
        <strong>Datos fiscales (factura)</strong>
        <div className="row">
          <label className="field">
            <span className="muted">Nombre / razon social</span>
            <input
              className="input"
              value={fiscal?.issuerName ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerName: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">NIF</span>
            <input
              className="input"
              value={fiscal?.issuerTaxId ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerTaxId: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Email</span>
            <input
              className="input"
              value={fiscal?.issuerEmail ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerEmail: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Telefono</span>
            <input
              className="input"
              value={fiscal?.issuerPhone ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerPhone: e.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span className="muted">Direccion</span>
            <input
              className="input"
              value={fiscal?.issuerAddressLine1 ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerAddressLine1: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Direccion 2</span>
            <input
              className="input"
              value={fiscal?.issuerAddressLine2 ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerAddressLine2: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Codigo postal</span>
            <input
              className="input"
              value={fiscal?.issuerPostalCode ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerPostalCode: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Ciudad</span>
            <input
              className="input"
              value={fiscal?.issuerCity ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerCity: e.target.value,
                }))
              }
            />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span className="muted">Provincia</span>
            <input
              className="input"
              value={fiscal?.issuerProvince ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerProvince: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="muted">Pais</span>
            <input
              className="input"
              value={fiscal?.issuerCountry ?? ""}
              onChange={(e) =>
                setFiscal((prev) => ({
                  ...(prev ?? {}),
                  issuerCountry: e.target.value,
                }))
              }
            />
          </label>
          <button className="button" onClick={saveFiscal}>
            Guardar datos fiscales
          </button>
        </div>
        {fiscalStatus && <p className="muted">{fiscalStatus}</p>}
      </div>
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
          <a className="button secondary" href="/settings/audit">
            Ver log
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
            {importRunning ? "Importando..." : "Importar ZIP"}
          </button>
        </div>
        {importStatus && <p className="muted">{importStatus}</p>}
      </div>
      <div className="card stack">
        <strong>Migracion / Limpiar datos</strong>
        <p className="muted">
          Selecciona que quieres borrar. Esto elimina datos, no los backups.
        </p>
        <div className="row">
          <button className="button secondary" onClick={selectAllPurgeTargets}>
            Seleccionar todo
          </button>
          <button className="button secondary" onClick={clearPurgeTargets}>
            Limpiar seleccion
          </button>
        </div>
        <div className="row">
          {purgeOptions.map((opt) => (
            <label key={opt.key} className="chip">
              <input
                type="checkbox"
                checked={purgeTargets.includes(opt.key)}
                onChange={() => togglePurgeTarget(opt.key)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <div className="row">
          <button className="button danger" onClick={runPurge}>
            Borrar seleccionados
          </button>
        </div>
        {purgeStatus && <p className="muted">{purgeStatus}</p>}
      </div>
    </div>
  );
}
