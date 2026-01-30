"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

const baseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

type Status = {
  id: number;
  name: string;
  sortOrder: number;
  color?: string | null;
  phaseId: number;
};

type Phase = {
  id: number;
  name: string;
  sortOrder: number;
  color?: string | null;
};

type Automation = {
  id: number;
  name: string;
  trigger: string;
  enabled: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
};

type StatusForm = {
  id?: number;
  name: string;
  sortOrder: string;
  color: string;
  rules: string;
};

type AutomationForm = {
  id?: number;
  name: string;
  trigger: string;
  enabled: boolean;
  conditions: string;
  actions: string;
};

export default function CrmSettingsPage() {
  const [tab, setTab] = useState<"statuses" | "automations">("statuses");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [phaseId, setPhaseId] = useState<number | null>(null);
  const [editingStatus, setEditingStatus] = useState<StatusForm | null>(null);
  const [editingAutomation, setEditingAutomation] =
    useState<AutomationForm | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [crmFile, setCrmFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "restore">("merge");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    refresh().catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (phaseId) {
      loadStatuses(phaseId).catch((err) => setStatus(err.message));
    }
  }, [phaseId]);

  async function refresh() {
    const [phasesResp, automationResp] = await Promise.all([
      api.get<Phase[]>("/crm/phases"),
      api.get<Automation[]>("/crm/automations"),
    ]);
    setPhases(phasesResp);
    setAutomations(automationResp);
    if (!phaseId && phasesResp.length > 0) {
      setPhaseId(phasesResp[0].id);
    }
  }

  async function loadStatuses(activePhaseId: number) {
    const statusResp = await api.get<Status[]>(
      `/crm/statuses?phase=${activePhaseId}`,
    );
    setStatuses(statusResp);
  }

  function openStatusForm(item?: Status) {
    setEditingStatus({
      id: item?.id,
      name: item?.name ?? "",
      sortOrder: item?.sortOrder ? String(item.sortOrder) : "",
      color: item?.color ?? "",
      rules: "",
    });
  }

  function openAutomationForm(item?: Automation) {
    setEditingAutomation({
      id: item?.id,
      name: item?.name ?? "",
      trigger: item?.trigger ?? "on_status_changed",
      enabled: item?.enabled ?? true,
      conditions: JSON.stringify(item?.conditions ?? {}, null, 2),
      actions: JSON.stringify(item?.actions ?? [], null, 2),
    });
  }

  async function saveStatus() {
    if (!editingStatus) return;
    const payload: Record<string, unknown> = {
      name: editingStatus.name.trim(),
      color: editingStatus.color.trim() || undefined,
    };
    if (editingStatus.sortOrder) {
      payload.sortOrder = Number(editingStatus.sortOrder);
    }
    if (editingStatus.rules.trim()) {
      payload.rules = JSON.parse(editingStatus.rules);
    }
    if (!payload.name) {
      setStatus("Nombre requerido");
      return;
    }
    if (!editingStatus.id) {
      if (!phaseId) {
        setStatus("Selecciona una fase");
        return;
      }
      payload.phaseId = phaseId;
    }
    if (editingStatus.id) {
      await api.patch(`/crm/statuses/${editingStatus.id}`, payload);
    } else {
      await api.post("/crm/statuses", payload);
    }
    setEditingStatus(null);
    if (phaseId) {
      await loadStatuses(phaseId);
    }
  }

  async function deleteStatus(id: number) {
    if (!confirm("Eliminar estado CRM?")) return;
    await api.patch(`/crm/statuses/${id}/delete`, {});
    if (phaseId) {
      await loadStatuses(phaseId);
    }
  }

  async function saveAutomation() {
    if (!editingAutomation) return;
    const payload = {
      name: editingAutomation.name.trim(),
      trigger: editingAutomation.trigger,
      enabled: editingAutomation.enabled,
      conditions: JSON.parse(editingAutomation.conditions || "{}"),
      actions: JSON.parse(editingAutomation.actions || "[]"),
    };
    if (!payload.name) {
      setStatus("Nombre requerido");
      return;
    }
    if (editingAutomation.id) {
      await api.patch(`/crm/automations/${editingAutomation.id}`, payload);
    } else {
      await api.post("/crm/automations", payload);
    }
    setEditingAutomation(null);
    await refresh();
  }

  async function deleteAutomation(id: number) {
    if (!confirm("Eliminar automatizacion?")) return;
    await api.patch(`/crm/automations/${id}/delete`, {});
    await refresh();
  }

  async function handleExport() {
    setStatus(null);
    setImportStatus(null);
    setExporting(true);
    try {
      const blob = await api.download("/crm/export");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "crm-export.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!crmFile) {
      setStatus("Selecciona un archivo ZIP");
      return;
    }
    setStatus(null);
    setImportStatus(null);
    setImporting(true);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const form = new FormData();
      form.append("file", crmFile);
      const res = await fetch(`${baseUrl}/crm/import?mode=${importMode}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      const data = await res.json();
      setImportStatus(
        `Importado correctamente (modo ${data.mode ?? importMode}).`,
      );
      setCrmFile(null);
    } catch (err: any) {
      setStatus(err.message ?? String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="stack">
      <h2>Ajustes CRM</h2>

      <div className="card stack">
        <div className="row crm-settings-actions">
          <button
            className={`tab-button ${tab === "statuses" ? "active" : ""}`}
            onClick={() => setTab("statuses")}
          >
            Estados
          </button>
          <button
            className={`tab-button ${tab === "automations" ? "active" : ""}`}
            onClick={() => setTab("automations")}
          >
            Automatizaciones
          </button>
          {tab === "statuses" ? (
            <button className="secondary" onClick={() => openStatusForm()}>
              Nuevo estado
            </button>
          ) : (
            <button className="secondary" onClick={() => openAutomationForm()}>
              Nueva automatizacion
            </button>
          )}
        </div>
      </div>

      <div className="card stack">
        <strong>Import/Export CRM</strong>
        <div className="row crm-settings-export-row">
          <button onClick={handleExport} disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar CRM"}
          </button>
          <label className="stack">
            <span className="muted">Modo importacion</span>
            <select
              className="input"
              value={importMode}
              onChange={(e) =>
                setImportMode(e.target.value as "merge" | "restore")
              }
            >
              <option value="merge">Merge (conservar datos)</option>
              <option value="restore">Restore (reemplazar CRM)</option>
            </select>
          </label>
          <label className="stack">
            <span className="muted">Archivo ZIP</span>
            <input
              className="input"
              type="file"
              accept=".zip"
              onChange={(e) => setCrmFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            className="secondary"
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? "Importando..." : "Importar CRM"}
          </button>
        </div>
        {importStatus && <p className="muted">{importStatus}</p>}
      </div>

      {tab === "statuses" && (
        <div className="card stack">
          <div className="row">
            <label className="stack">
              <span className="muted">Fase</span>
              <select
                className="input"
                value={phaseId ?? ""}
                onChange={(e) => setPhaseId(Number(e.target.value))}
              >
                {phases.map((phase) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Orden</th>
                <th>Nombre</th>
                <th>Color</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((item) => (
                <tr key={item.id}>
                  <td>{item.sortOrder}</td>
                  <td>{item.name}</td>
                  <td>{item.color ?? "-"}</td>
                  <td className="row center-actions">
                    <button
                      className="secondary"
                      onClick={() => openStatusForm(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="secondary"
                      onClick={() => deleteStatus(item.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {statuses.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin estados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "automations" && (
        <div className="card stack">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Trigger</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {automations.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.trigger}</td>
                  <td>{item.enabled ? "Si" : "No"}</td>
                  <td className="row center-actions">
                    <button
                      className="secondary"
                      onClick={() => openAutomationForm(item)}
                    >
                      Editar
                    </button>
                    <button
                      className="secondary"
                      onClick={() => deleteAutomation(item.id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {automations.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sin automatizaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingStatus && (
        <div className="modal-backdrop" onClick={() => setEditingStatus(null)}>
          <div
            className="card stack modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>{editingStatus.id ? "Editar estado" : "Nuevo estado"}</strong>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={editingStatus.name}
                onChange={(e) =>
                  setEditingStatus({ ...editingStatus, name: e.target.value })
                }
              />
            </label>
            <div className="row">
              <label className="stack">
                <span className="muted">Orden</span>
                <input
                  className="input"
                  type="number"
                  value={editingStatus.sortOrder}
                  onChange={(e) =>
                    setEditingStatus({
                      ...editingStatus,
                      sortOrder: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Color</span>
                <input
                  className="input"
                  value={editingStatus.color}
                  onChange={(e) =>
                    setEditingStatus({ ...editingStatus, color: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="stack">
              <span className="muted">Reglas (json)</span>
              <textarea
                className="input"
                value={editingStatus.rules}
                onChange={(e) =>
                  setEditingStatus({ ...editingStatus, rules: e.target.value })
                }
              />
            </label>
            <div className="row">
              <button onClick={saveStatus}>Guardar</button>
              <button
                className="secondary"
                onClick={() => setEditingStatus(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAutomation && (
        <div
          className="modal-backdrop"
          onClick={() => setEditingAutomation(null)}
        >
          <div
            className="card stack modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>
              {editingAutomation.id ? "Editar automatizacion" : "Nueva automatizacion"}
            </strong>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={editingAutomation.name}
                onChange={(e) =>
                  setEditingAutomation({
                    ...editingAutomation,
                    name: e.target.value,
                  })
                }
              />
            </label>
            <div className="row">
              <label className="stack">
                <span className="muted">Trigger</span>
                <select
                  className="input"
                  value={editingAutomation.trigger}
                  onChange={(e) =>
                    setEditingAutomation({
                      ...editingAutomation,
                      trigger: e.target.value,
                    })
                  }
                >
                  <option value="on_status_changed">on_status_changed</option>
                  <option value="on_task_completed">on_task_completed</option>
                  <option value="daily_scheduler">daily_scheduler</option>
                </select>
              </label>
              <label className="stack">
                <span className="muted">Activo</span>
                <select
                  className="input"
                  value={editingAutomation.enabled ? "true" : "false"}
                  onChange={(e) =>
                    setEditingAutomation({
                      ...editingAutomation,
                      enabled: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </label>
            </div>
            <label className="stack">
              <span className="muted">Condiciones (json)</span>
              <textarea
                className="input"
                rows={6}
                value={editingAutomation.conditions}
                onChange={(e) =>
                  setEditingAutomation({
                    ...editingAutomation,
                    conditions: e.target.value,
                  })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Acciones (json)</span>
              <textarea
                className="input"
                rows={6}
                value={editingAutomation.actions}
                onChange={(e) =>
                  setEditingAutomation({
                    ...editingAutomation,
                    actions: e.target.value,
                  })
                }
              />
            </label>
            <div className="row">
              <button onClick={saveAutomation}>Guardar</button>
              <button
                className="secondary"
                onClick={() => setEditingAutomation(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
