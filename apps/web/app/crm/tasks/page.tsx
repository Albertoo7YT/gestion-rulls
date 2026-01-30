"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type User = { id: number; username: string };
type Customer = { id: number; name: string };

type CrmTask = {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  priority?: number | null;
  ownerId?: number | null;
  owner?: User | null;
  relatedCustomerId?: number | null;
  customer?: Customer | null;
};

type TaskForm = {
  id?: number;
  title: string;
  type: string;
  description: string;
  dueAt: string;
  priority: string;
  ownerId: string;
  relatedCustomerId: string;
};

const QUICK_TEMPLATES = [
  { title: "Primer contacto", type: "call", dueDays: 0 },
  { title: "Enviar catalogo", type: "email", dueDays: 0 },
  { title: "Seguimiento 48h", type: "follow_up", dueDays: 2 },
  { title: "Postventa 48h", type: "post_sale", dueDays: 2 },
];

export default function CrmTasksPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState("today");
  const [groupByCustomer, setGroupByCustomer] = useState(true);
  const [editing, setEditing] = useState<TaskForm | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<CrmTask[]>("/crm/tasks"),
      api.get<Customer[]>("/customers"),
      api.get<User[]>("/users"),
    ])
      .then(([taskResp, customerResp, userResp]) => {
        setTasks(taskResp);
        setCustomers(customerResp);
        setUsers(userResp);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => !task.completedAt),
    [tasks],
  );

  const now = new Date();
  const todayTasks = pendingTasks.filter((task) => isSameDay(task.dueAt, now));
  const weekRange = getWeekRange(now);
  const weekTasks = pendingTasks.filter((task) =>
    isWithinRange(task.dueAt, weekRange.start, weekRange.end),
  );
  const overdueTasks = pendingTasks.filter((task) =>
    isOverdue(task.dueAt, now),
  );
  const completedTasks = tasks.filter((task) => task.completedAt);

  const customersWithoutNextTask = useMemo(() => {
    const withPending = new Set(
      pendingTasks
        .map((task) => task.relatedCustomerId)
        .filter((id): id is number => Boolean(id)),
    );
    return customers.filter((customer) => !withPending.has(customer.id));
  }, [customers, pendingTasks]);

  const tabTasks = useMemo(() => {
    switch (activeTab) {
      case "today":
        return todayTasks;
      case "week":
        return weekTasks;
      case "overdue":
        return overdueTasks;
      case "done":
        return completedTasks;
      default:
        return [];
    }
  }, [activeTab, todayTasks, weekTasks, overdueTasks, completedTasks]);

  function openTaskForm(task?: CrmTask, customerId?: number) {
    setEditing({
      id: task?.id,
      title: task?.title ?? "",
      type: task?.type ?? "call",
      description: task?.description ?? "",
      dueAt: task?.dueAt ? toLocalInput(task.dueAt) : "",
      priority: task?.priority ? String(task.priority) : "",
      ownerId: task?.ownerId ? String(task.ownerId) : "",
      relatedCustomerId:
        task?.relatedCustomerId?.toString() ??
        (customerId ? String(customerId) : ""),
    });
  }

  async function saveTask() {
    if (!editing) return;
    setStatus(null);
    const payload = {
      title: editing.title.trim(),
      type: editing.type.trim(),
      description: editing.description.trim() || undefined,
      dueAt: editing.dueAt || toLocalInput(new Date().toISOString()),
      priority: editing.priority ? Number(editing.priority) : undefined,
      ownerId: editing.ownerId ? Number(editing.ownerId) : undefined,
      relatedCustomerId: editing.relatedCustomerId
        ? Number(editing.relatedCustomerId)
        : undefined,
    };
    if (!payload.title) return;

    if (editing.id) {
      await api.patch(`/crm/tasks/${editing.id}`, payload);
    } else {
      await api.post("/crm/tasks", payload);
    }
    await refresh();
    setEditing(null);
  }

  async function refresh() {
    const taskResp = await api.get<CrmTask[]>("/crm/tasks");
    setTasks(taskResp);
  }

  async function completeTask(task: CrmTask) {
    await api.patch(`/crm/tasks/${task.id}`, {
      completedAt: new Date().toISOString(),
    });
    await refresh();
  }

  async function reassignTask(task: CrmTask, ownerId: string) {
    await api.patch(`/crm/tasks/${task.id}`, {
      ownerId: ownerId ? Number(ownerId) : null,
    });
    await refresh();
  }

  async function removeTask(task: CrmTask) {
    if (!confirm("Eliminar tarea?")) return;
    await api.del(`/crm/tasks/${task.id}`);
    await refresh();
  }

  function applyTemplate(template: (typeof QUICK_TEMPLATES)[number]) {
    if (!editing) return;
    const dueAt = template.dueDays
      ? addDays(new Date(), template.dueDays)
      : new Date();
    const dueIso =
      dueAt instanceof Date ? dueAt.toISOString() : new Date(dueAt).toISOString();
    setEditing({
      ...editing,
      title: template.title,
      type: template.type,
      dueAt: toLocalInput(dueIso),
    });
  }

  function renderTasks(list: CrmTask[]) {
    if (!groupByCustomer) {
      return (
        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Tarea</th>
              <th>Vence</th>
              <th>Responsable</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {list.map((task) => (
              <tr key={task.id}>
                <td>{task.customer?.name ?? "-"}</td>
                <td>
                  <button className="link-button" onClick={() => openTaskForm(task)}>
                    {task.title}
                  </button>
                </td>
                <td>{task.dueAt ? formatDate(task.dueAt) : "-"}</td>
                <td>
                  <select
                    className="input"
                    value={task.ownerId ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => reassignTask(task, e.target.value)}
                  >
                    <option value="">Sin responsable</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="row center-actions">
                  {!task.completedAt && (
                  <button
                    className="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      completeTask(task);
                    }}
                  >
                    Completar
                  </button>
                  )}
                  <button
                    className="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTaskForm(task);
                    }}
                  >
                    Editar
                  </button>
                  <button
                    className="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTask(task);
                    }}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Sin tareas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }

    const grouped = list.reduce<Record<string, CrmTask[]>>((acc, task) => {
      const key = task.customer?.name ?? "Sin cliente";
      acc[key] = acc[key] ? [...acc[key], task] : [task];
      return acc;
    }, {});

    return Object.entries(grouped).map(([customerName, group]) => (
      <div key={customerName} className="card stack">
        <strong className="crm-group-title">{customerName}</strong>
        {group.map((task) => (
          <div key={task.id} className="crm-timeline-item">
            <div className="row">
              <button className="link-button" onClick={() => openTaskForm(task)}>
                <strong>{task.title}</strong>
              </button>
              <span className="muted">
                {task.dueAt ? formatDate(task.dueAt) : "Sin fecha"}
              </span>
            </div>
            <div className="row">
              <select
                className="input"
                value={task.ownerId ?? ""}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => reassignTask(task, e.target.value)}
              >
                <option value="">Sin responsable</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              {!task.completedAt && (
                <button
                  className="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask(task);
                  }}
                >
                  Completar
                </button>
              )}
              <button
                className="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openTaskForm(task);
                }}
              >
                Editar
              </button>
              <button
                className="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTask(task);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
    ));
  }

  return (
    <div className="stack">
      <h2>Tareas CRM</h2>

      <div className="card stack">
        <div className="row">
          <button
            className={`tab-button ${activeTab === "today" ? "active" : ""}`}
            onClick={() => setActiveTab("today")}
          >
            Hoy
          </button>
          <button
            className={`tab-button ${activeTab === "week" ? "active" : ""}`}
            onClick={() => setActiveTab("week")}
          >
            Semana
          </button>
          <button
            className={`tab-button ${activeTab === "overdue" ? "active" : ""}`}
            onClick={() => setActiveTab("overdue")}
          >
            Vencidas
          </button>
          <button
            className={`tab-button ${activeTab === "done" ? "active" : ""}`}
            onClick={() => setActiveTab("done")}
          >
            Completadas
          </button>
          <button
            className={`tab-button ${activeTab === "no-task" ? "active" : ""}`}
            onClick={() => setActiveTab("no-task")}
          >
            Sin proxima tarea
          </button>
          <button className="secondary" onClick={() => openTaskForm()}>
            Nueva tarea
          </button>
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={groupByCustomer}
            onChange={(e) => setGroupByCustomer(e.target.checked)}
          />
          Agrupar por cliente
        </label>
      </div>

      {activeTab === "no-task" ? (
        <div className="card stack">
          <strong>Clientes sin proxima tarea</strong>
          {customersWithoutNextTask.length === 0 && (
            <div className="muted">Todos tienen tareas pendientes.</div>
          )}
          {customersWithoutNextTask.map((customer) => (
            <div key={customer.id} className="row">
              <span>{customer.name}</span>
              <button
                className="secondary"
                onClick={() => openTaskForm(undefined, customer.id)}
              >
                Nueva tarea
              </button>
              <a
                className="button secondary"
                href={`/crm/customers/${customer.id}`}
              >
                Abrir ficha
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="stack">{renderTasks(tabTasks)}</div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div
            className="card stack modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <strong>{editing.id ? "Editar tarea" : "Nueva tarea"}</strong>
            <div className="row">
              <label className="stack">
                <span className="muted">Titulo</span>
                <input
                  className="input"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing({ ...editing, title: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Tipo</span>
                <input
                  className="input"
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({ ...editing, type: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Vence</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={editing.dueAt}
                  onChange={(e) =>
                    setEditing({ ...editing, dueAt: e.target.value })
                  }
                />
              </label>
              <label className="stack">
                <span className="muted">Cliente</span>
                <select
                  className="input"
                  value={editing.relatedCustomerId}
                  onChange={(e) =>
                    setEditing({ ...editing, relatedCustomerId: e.target.value })
                  }
                >
                  <option value="">Sin cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Responsable</span>
                <select
                  className="input"
                  value={editing.ownerId}
                  onChange={(e) =>
                    setEditing({ ...editing, ownerId: e.target.value })
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
                  value={editing.priority}
                  onChange={(e) =>
                    setEditing({ ...editing, priority: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="stack">
              <span className="muted">Descripcion</span>
              <textarea
                className="input"
                value={editing.description}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
              />
            </label>

            <div className="row">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.title}
                  className="secondary"
                  onClick={() => applyTemplate(template)}
                >
                  {template.title}
                </button>
              ))}
            </div>
            <div className="row">
              <button onClick={saveTask}>Guardar</button>
              <button className="secondary" onClick={() => setEditing(null)}>
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

function isSameDay(dateValue: string | null | undefined, ref: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  );
}

function isWithinRange(
  dateValue: string | null | undefined,
  start: Date,
  end: Date,
) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= start && date <= end;
}

function getWeekRange(base: Date) {
  const start = new Date(base);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isOverdue(dateValue: string | null | undefined, ref: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date.getTime() < ref.getTime();
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
