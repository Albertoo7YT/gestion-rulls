"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type User = { id: number; username: string };
type Status = { id: number; name: string };
type Segment = {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  dynamic: boolean;
};
type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
};

type SegmentForm = {
  name: string;
  q: string;
  lastPurchaseDays: string;
  totalSpentMin: string;
  avgTicketMin: string;
  purchaseCountMin: string;
  returnsCountMin: string;
  tag: string;
  channel: string;
  city: string;
  statusId: string;
  ownerId: string;
  active: string;
};

type BulkTaskForm = {
  title: string;
  type: string;
  description: string;
  dueAt: string;
  priority: string;
  ownerId: string;
};

export default function CrmSegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [segmentForm, setSegmentForm] = useState<SegmentForm>({
    name: "",
    q: "",
    lastPurchaseDays: "",
    totalSpentMin: "",
    avgTicketMin: "",
    purchaseCountMin: "",
    returnsCountMin: "",
    tag: "",
    channel: "",
    city: "",
    statusId: "",
    ownerId: "",
    active: "",
  });
  const [bulkForm, setBulkForm] = useState<BulkTaskForm>({
    title: "",
    type: "call",
    description: "",
    dueAt: "",
    priority: "",
    ownerId: "",
  });

  useEffect(() => {
    Promise.all([
      api.get<Segment[]>("/crm/segments"),
      api.get<User[]>("/users"),
      api.get<{ statuses: { id: number; name: string }[] }>("/crm/board"),
    ])
      .then(([segmentResp, userResp, boardResp]) => {
        setSegments(segmentResp);
        setUsers(userResp);
        setStatuses(
          boardResp.statuses.map((item) => ({ id: item.id, name: item.name })),
        );
        if (segmentResp.length) {
          setSelectedId(segmentResp[0].id);
        }
      })
      .catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api
      .get<Customer[]>(`/crm/segments/${selectedId}/customers`)
      .then(setCustomers)
      .catch((err) => setStatus(err.message));
  }, [selectedId]);

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === selectedId) ?? null,
    [segments, selectedId],
  );

  const filtersPreview = useMemo(() => buildFilters(segmentForm), [segmentForm]);

  function buildFilters(form: SegmentForm) {
    const filters: Record<string, unknown> = {};
    if (form.q.trim()) filters.q = form.q.trim();
    if (form.lastPurchaseDays) filters.lastPurchaseDays = Number(form.lastPurchaseDays);
    if (form.totalSpentMin) filters.totalSpentMin = Number(form.totalSpentMin);
    if (form.avgTicketMin) filters.avgTicketMin = Number(form.avgTicketMin);
    if (form.purchaseCountMin) filters.purchaseCountMin = Number(form.purchaseCountMin);
    if (form.returnsCountMin) filters.returnsCountMin = Number(form.returnsCountMin);
    if (form.tag.trim()) filters.tag = form.tag.trim();
    if (form.channel) filters.channel = form.channel;
    if (form.city.trim()) filters.city = form.city.trim();
    if (form.statusId) filters.statusId = Number(form.statusId);
    if (form.ownerId) filters.ownerId = Number(form.ownerId);
    if (form.active !== "") filters.active = form.active === "true";
    return filters;
  }

  async function createSegment() {
    setStatus(null);
    const name = segmentForm.name.trim();
    if (!name) {
      setStatus("Nombre requerido");
      return;
    }
    const payload = {
      name,
      filters: filtersPreview,
      dynamic: true,
    };
    const created = await api.post<Segment>("/crm/segments", payload);
    const updated = await api.get<Segment[]>("/crm/segments");
    setSegments(updated);
    setSelectedId(created.id);
    setCreating(false);
  }

  async function bulkCreateTasks() {
    if (!selectedId) return;
    const payload = {
      segmentId: selectedId,
      task: {
        title: bulkForm.title.trim(),
        type: bulkForm.type.trim() || "call",
        description: bulkForm.description.trim() || undefined,
        dueAt: bulkForm.dueAt || undefined,
        priority: bulkForm.priority ? Number(bulkForm.priority) : undefined,
        ownerId: bulkForm.ownerId ? Number(bulkForm.ownerId) : undefined,
      },
    };
    if (!payload.task.title) {
      setStatus("Titulo requerido para la tarea");
      return;
    }
    await api.post("/crm/tasks/bulk", payload);
    setBulkOpen(false);
  }

  return (
    <div className="stack">
      <div className="row">
        <h2>Segmentos CRM</h2>
        <button className="secondary" onClick={() => setCreating(true)}>
          Nuevo segmento
        </button>
      </div>

      <div className="crm-segment-grid">
        <div className="card stack">
          <strong>Segmentos</strong>
          {segments.map((segment) => (
            <button
              key={segment.id}
              className={`crm-segment-item ${
                segment.id === selectedId ? "active" : ""
              }`}
              onClick={() => setSelectedId(segment.id)}
            >
              {segment.name}
            </button>
          ))}
        </div>

        <div className="card stack">
          <div className="row">
            <strong>{selectedSegment?.name ?? "Selecciona un segmento"}</strong>
            <button
              className="secondary"
              disabled={!selectedId || customers.length === 0}
              onClick={() => setBulkOpen(true)}
            >
              Crear tareas en lote
            </button>
          </div>
          {selectedSegment && (
            <pre className="crm-json-preview">
              {JSON.stringify(selectedSegment.filters ?? {}, null, 2)}
            </pre>
          )}

          <div className="stack">
            <strong>Clientes</strong>
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Telefono</th>
                  <th>Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.email ?? "-"}</td>
                    <td>{customer.phone ?? "-"}</td>
                    <td>{customer.city ?? "-"}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Sin clientes para este segmento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {creating && (
        <div className="modal-backdrop" onClick={() => setCreating(false)}>
          <div
            className="card stack modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>Nuevo segmento</strong>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={segmentForm.name}
                onChange={(e) =>
                  setSegmentForm({ ...segmentForm, name: e.target.value })
                }
              />
            </label>
            <div className="row">
              <label className="stack">
                <span className="muted">Busqueda</span>
                <input
                  className="input"
                  value={segmentForm.q}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, q: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Ciudad</span>
                <input
                  className="input"
                  value={segmentForm.city}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, city: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Canal</span>
                <select
                  className="input"
                  value={segmentForm.channel}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, channel: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="B2B">B2B</option>
                  <option value="B2C">B2C</option>
                </select>
              </label>
              <label className="stack">
                <span className="muted">Tag</span>
                <input
                  className="input"
                  value={segmentForm.tag}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, tag: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Ultima compra (dias)</span>
                <input
                  className="input"
                  type="number"
                  value={segmentForm.lastPurchaseDays}
                  onChange={(e) =>
                    setSegmentForm({
                      ...segmentForm,
                      lastPurchaseDays: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Total gastado &gt;=</span>
                <input
                  className="input"
                  type="number"
                  value={segmentForm.totalSpentMin}
                  onChange={(e) =>
                    setSegmentForm({
                      ...segmentForm,
                      totalSpentMin: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Ticket medio &gt;=</span>
                <input
                  className="input"
                  type="number"
                  value={segmentForm.avgTicketMin}
                  onChange={(e) =>
                    setSegmentForm({
                      ...segmentForm,
                      avgTicketMin: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Compras &gt;=</span>
                <input
                  className="input"
                  type="number"
                  value={segmentForm.purchaseCountMin}
                  onChange={(e) =>
                    setSegmentForm({
                      ...segmentForm,
                      purchaseCountMin: e.target.value,
                    })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Devoluciones &gt;=</span>
                <input
                  className="input"
                  type="number"
                  value={segmentForm.returnsCountMin}
                  onChange={(e) =>
                    setSegmentForm({
                      ...segmentForm,
                      returnsCountMin: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Estado CRM</span>
                <select
                  className="input"
                  value={segmentForm.statusId}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, statusId: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  {statuses.map((statusItem) => (
                    <option key={statusItem.id} value={statusItem.id}>
                      {statusItem.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Responsable</span>
                <select
                  className="input"
                  value={segmentForm.ownerId}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, ownerId: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Activo</span>
                <select
                  className="input"
                  value={segmentForm.active}
                  onChange={(e) =>
                    setSegmentForm({ ...segmentForm, active: e.target.value })
                  }
                >
                  <option value="">Todos</option>
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
            </div>
            <label className="stack">
              <span className="muted">Filtros (preview)</span>
              <pre className="crm-json-preview">
                {JSON.stringify(filtersPreview, null, 2)}
              </pre>
            </label>
            <div className="row">
              <button onClick={createSegment}>Guardar segmento</button>
              <button className="secondary" onClick={() => setCreating(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="modal-backdrop" onClick={() => setBulkOpen(false)}>
          <div
            className="card stack modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>Crear tareas en lote</strong>
            <div className="row">
              <label className="stack">
                <span className="muted">Titulo</span>
                <input
                  className="input"
                  value={bulkForm.title}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, title: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Tipo</span>
                <input
                  className="input"
                  value={bulkForm.type}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, type: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Vence</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={bulkForm.dueAt}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, dueAt: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="row">
              <label className="stack">
                <span className="muted">Responsable</span>
                <select
                  className="input"
                  value={bulkForm.ownerId}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, ownerId: e.target.value })
                  }
                >
                  <option value="">Sin responsable</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Prioridad</span>
                <input
                  className="input"
                  type="number"
                  value={bulkForm.priority}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, priority: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="stack">
              <span className="muted">Descripcion</span>
              <textarea
                className="input"
                value={bulkForm.description}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, description: e.target.value })
                }
              />
            </label>
            <div className="row">
              <button onClick={bulkCreateTasks}>Crear tareas</button>
              <button className="secondary" onClick={() => setBulkOpen(false)}>
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
