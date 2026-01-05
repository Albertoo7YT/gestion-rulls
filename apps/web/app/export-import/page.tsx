"use client";

import { useState } from "react";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

export default function ExportImportPage() {
  const [mode, setMode] = useState<"restore" | "merge">("merge");
  const [status, setStatus] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  async function downloadExport() {
    setStatus(null);
    const res = await fetch(`${baseUrl}/export`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function uploadImport(file: File) {
    setStatus(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${baseUrl}/import?mode=${mode}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || res.statusText);
    }
    const data = await res.json();
    setStatus(JSON.stringify(data));
  }

  return (
    <div className="stack">
      <h2>Export / Import</h2>
      <div className="card stack">
        <div className="row">
          <button onClick={() => setShowExport((prev) => !prev)}>
            {showExport ? "Ocultar export" : "Exportar"}
          </button>
          <button
            className="secondary"
            onClick={() => setShowImport((prev) => !prev)}
          >
            {showImport ? "Ocultar import" : "Importar"}
          </button>
        </div>
        {showExport && (
          <button
            onClick={() =>
              downloadExport().catch((err) => setStatus(err.message))
            }
          >
            Descargar export.zip
          </button>
        )}
        {showImport && (
          <div className="row">
            <label className="stack">
              <span className="muted">Modo importacion</span>
              <select
                className="input"
                value={mode}
                onChange={(e) => setMode(e.target.value as "restore" | "merge")}
              >
                <option value="merge">Merge</option>
                <option value="restore">Restore</option>
              </select>
            </label>
            <label className="stack">
              <span className="muted">Archivo ZIP</span>
              <input
                className="input"
                type="file"
                accept=".zip"
                onChange={(e) =>
                  e.target.files?.[0] &&
                  uploadImport(e.target.files[0]).catch((err) =>
                    setStatus(err.message),
                  )
                }
              />
            </label>
          </div>
        )}
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
