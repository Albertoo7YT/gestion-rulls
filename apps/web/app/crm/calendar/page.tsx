"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type User = { id: number; username: string };
type Customer = { id: number; name: string };

type CrmEvent = {
  id: number;
  type: string;
  title?: string | null;
  startAt: string;
  endAt?: string | null;
  ownerId?: number | null;
  customerId?: number | null;
  owner?: User | null;
  customer?: Customer | null;
};

type CrmTask = {
  id: number;
  title: string;
  dueAt?: string | null;
  type?: string | null;
  description?: string | null;
  ownerId?: number | null;
  relatedCustomerId?: number | null;
  customer?: Customer | null;
};

type CalendarItem = {
  id: string;
  source: "event" | "task";
  title: string;
  startAt: string;
  endAt?: string | null;
  owner?: User | null;
  ownerId?: number | null;
  customer?: Customer | null;
  rawId: number;
};

export default function CrmCalendarPage() {
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [view, setView] = useState<"week" | "month">("week");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [activeDate, setActiveDate] = useState(new Date());
  const [status, setStatus] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [modalMode, setModalMode] = useState<"event" | "task">("event");
  const [eventForm, setEventForm] = useState({
    title: "",
    type: "visit",
    startAt: "",
    endAt: "",
    ownerId: "",
    customerId: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    type: "call",
    dueAt: "",
    ownerId: "",
    customerId: "",
    description: "",
  });

  useEffect(() => {
    Promise.all([
      api.get<User[]>("/users"),
      api.get<Customer[]>("/customers"),
    ])
      .then(([userResp, customerResp]) => {
        setUsers(userResp);
        setCustomers(customerResp);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    loadCalendar().catch((err) => setStatus(err.message));
  }, [activeDate, ownerFilter, view]);

  async function loadCalendar() {
    const { from, to } = getRange(activeDate, view);
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });
    if (ownerFilter) params.set("owner", ownerFilter);

    const taskParams = new URLSearchParams({
      from: params.get("from") ?? "",
      to: params.get("to") ?? "",
    });

    const [eventsResp, tasksResp] = await Promise.all([
      api.get<CrmEvent[]>(`/crm/calendar?${params}`),
      api.get<CrmTask[]>(`/crm/tasks?${taskParams}`),
    ]);
    setEvents(eventsResp);
    setTasks(tasksResp);
  }

  const items = useMemo<CalendarItem[]>(() => {
    const eventItems = events.map((event) => ({
      id: `event-${event.id}`,
      source: "event" as const,
      title: event.title || event.type,
      startAt: event.startAt,
      endAt: event.endAt,
      owner: event.owner ?? null,
      ownerId: event.ownerId ?? null,
      customer: event.customer ?? null,
      rawId: event.id,
    }));
    const taskItems = tasks
      .filter((task) => task.dueAt)
      .map((task) => ({
        id: `task-${task.id}`,
        source: "task" as const,
        title: task.title,
        startAt: task.dueAt as string,
        endAt: null,
        ownerId: task.ownerId ?? null,
        owner: null,
        customer: task.customer ?? null,
        rawId: task.id,
      }));
    return [...eventItems, ...taskItems];
  }, [events, tasks]);

  const days = view === "month" ? getMonthDays(activeDate) : getWeekDays(activeDate);

  function openCreateModal(date?: Date) {
    setEditingEventId(null);
    setEditingTaskId(null);
    setModalMode("event");
    setEventForm({
      title: "",
      type: "visit",
      startAt: date ? toLocalInput(date.toISOString()) : "",
      endAt: "",
      ownerId: "",
      customerId: "",
    });
    setShowModal(true);
  }

  function openCreateTaskModal(date?: Date) {
    setEditingTaskId(null);
    setEditingEventId(null);
    setModalMode("task");
    setTaskForm({
      title: "",
      type: "call",
      dueAt: date ? toLocalInput(date.toISOString()) : "",
      ownerId: "",
      customerId: "",
      description: "",
    });
    setShowModal(true);
  }

  function openEditEvent(item: CalendarItem) {
    const event = events.find((value) => value.id === item.rawId);
    if (!event) return;
    setEditingEventId(event.id);
    setEditingTaskId(null);
    setModalMode("event");
    setEventForm({
      title: event.title ?? "",
      type: event.type,
      startAt: toLocalInput(event.startAt),
      endAt: event.endAt ? toLocalInput(event.endAt) : "",
      ownerId: event.ownerId ? String(event.ownerId) : "",
      customerId: event.customerId ? String(event.customerId) : "",
    });
    setShowModal(true);
  }

  function openEditTask(item: CalendarItem) {
    const task = tasks.find((value) => value.id === item.rawId);
    if (!task) return;
    setEditingTaskId(task.id);
    setEditingEventId(null);
    setModalMode("task");
    setTaskForm({
      title: task.title ?? "",
      type: task.type ?? "call",
      dueAt: task.dueAt ? toLocalInput(task.dueAt) : "",
      ownerId: task.ownerId ? String(task.ownerId) : "",
      customerId: task.relatedCustomerId ? String(task.relatedCustomerId) : "",
      description: task.description ?? "",
    });
    setShowModal(true);
  }

  async function saveEvent() {
    if (!eventForm.startAt) return;
    const payload = {
      title: eventForm.title || undefined,
      type: eventForm.type || "visit",
      startAt: eventForm.startAt,
      endAt: eventForm.endAt || undefined,
      ownerId: eventForm.ownerId ? Number(eventForm.ownerId) : undefined,
      customerId: eventForm.customerId ? Number(eventForm.customerId) : undefined,
    };
    if (editingEventId) {
      await api.patch(`/crm/calendar/${editingEventId}`, payload);
    } else {
      await api.post("/crm/calendar", payload);
    }
    setEditingEventId(null);
    setShowModal(false);
    await loadCalendar();
  }

  async function saveTask() {
    if (!taskForm.dueAt) return;
    const payload = {
      title: taskForm.title || undefined,
      type: taskForm.type || "call",
      dueAt: taskForm.dueAt,
      ownerId: taskForm.ownerId ? Number(taskForm.ownerId) : undefined,
      relatedCustomerId: taskForm.customerId
        ? Number(taskForm.customerId)
        : undefined,
      description: taskForm.description || undefined,
    };
    if (editingTaskId) {
      await api.patch(`/crm/tasks/${editingTaskId}`, payload);
    } else {
      await api.post("/crm/tasks", payload);
    }
    setEditingTaskId(null);
    setShowModal(false);
    await loadCalendar();
  }

  function handleDragStart(
    event: React.DragEvent<HTMLDivElement>,
    item: CalendarItem,
  ) {
    event.dataTransfer.setData("text/plain", JSON.stringify(item));
    event.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>, day: Date) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    const item = JSON.parse(payload) as CalendarItem;
    const nextStart = new Date(day);
    if (view === "month") {
      nextStart.setHours(10, 0, 0, 0);
    }
    if (item.source === "event") {
      await api.patch(`/crm/calendar/${item.rawId}`, {
        startAt: nextStart.toISOString(),
        endAt: item.endAt ?? undefined,
      });
    } else {
      await api.patch(`/crm/tasks/${item.rawId}`, {
        dueAt: nextStart.toISOString(),
      });
    }
    await loadCalendar();
  }

  return (
    <div className="stack">
      <h2>Calendario CRM</h2>

      <div className="card stack">
        <div className="row crm-calendar-actions">
          <button
            className={`tab-button ${view === "week" ? "active" : ""}`}
            onClick={() => setView("week")}
          >
            Semana
          </button>
          <button
            className={`tab-button ${view === "month" ? "active" : ""}`}
            onClick={() => setView("month")}
          >
            Mes
          </button>
          <button className="secondary" onClick={() => openCreateModal()}>
            Crear evento
          </button>
          <button className="secondary" onClick={() => openCreateTaskModal()}>
            Crear tarea
          </button>
          <label className="stack">
            <span className="muted">Responsable</span>
            <select
              className="input"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row crm-calendar-range">
          <button
            className="secondary"
            onClick={() => setActiveDate(addDays(activeDate, view === "month" ? -30 : -7))}
          >
            Anterior
          </button>
          <span className="muted">{formatRange(activeDate, view)}</span>
          <button
            className="secondary"
            onClick={() => setActiveDate(addDays(activeDate, view === "month" ? 30 : 7))}
          >
            Siguiente
          </button>
        </div>
      </div>

      <div className="crm-board">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="crm-column"
            onDragOver={allowDrop}
            onDrop={(event) => handleDrop(event, day)}
          >
            <div className="crm-column-header">
              <span>{day.toLocaleDateString()}</span>
            </div>
            {items
              .filter((item) => isSameDay(item.startAt, day))
              .map((item) => (
                <div
                  key={item.id}
                  className="crm-card"
                  draggable
                  onDragStart={(event) => handleDragStart(event, item)}
                  onClick={() =>
                    item.source === "event"
                      ? openEditEvent(item)
                      : openEditTask(item)
                  }
                >
                  <div className="crm-card-title">{item.title}</div>
                  <div className="crm-card-meta">
                    <span>{item.source === "event" ? "Evento" : "Tarea"}</span>
                    {item.customer?.name && <span>{item.customer.name}</span>}
                  </div>
                </div>
              ))}
            <div className="row crm-calendar-day-actions">
              <button className="secondary" onClick={() => openCreateModal(day)}>
                Evento
              </button>
              <button
                className="secondary"
                onClick={() => openCreateTaskModal(day)}
              >
                Tarea
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>
              {modalMode === "task"
                ? editingTaskId
                  ? "Editar tarea"
                  : "Crear tarea"
                : editingEventId
                  ? "Editar evento"
                  : "Crear evento"}
            </strong>
            {modalMode === "task" ? (
              <div className="row">
                <label className="stack">
                  <span className="muted">Titulo</span>
                  <input
                    className="input"
                    value={taskForm.title}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, title: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Tipo</span>
                  <input
                    className="input"
                    value={taskForm.type}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, type: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Vence</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={taskForm.dueAt}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, dueAt: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Cliente</span>
                  <select
                    className="input"
                    value={taskForm.customerId}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, customerId: e.target.value })
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
                    value={taskForm.ownerId}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, ownerId: e.target.value })
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
                  <span className="muted">Descripcion</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={taskForm.description}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, description: e.target.value })
                    }
                  />
                </label>
              </div>
            ) : (
              <div className="row">
                <label className="stack">
                  <span className="muted">Titulo</span>
                  <input
                    className="input"
                    value={eventForm.title}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, title: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Tipo</span>
                  <input
                    className="input"
                    value={eventForm.type}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, type: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Inicio</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={eventForm.startAt}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, startAt: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Fin</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={eventForm.endAt}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, endAt: e.target.value })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Cliente</span>
                  <select
                    className="input"
                    value={eventForm.customerId}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, customerId: e.target.value })
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
                    value={eventForm.ownerId}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, ownerId: e.target.value })
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
              </div>
            )}
            <div className="row">
              <button onClick={modalMode === "task" ? saveTask : saveEvent}>
                Guardar
              </button>
              <button className="secondary" onClick={() => setShowModal(false)}>
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

function getRange(base: Date, view: "week" | "month") {
  const start = new Date(base);
  const end = new Date(base);
  if (view === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else {
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }
  return { from: start, to: end };
}

function getWeekDays(base: Date) {
  const { from } = getRange(base, "week");
  return Array.from({ length: 7 }, (_, idx) => {
    const day = new Date(from);
    day.setDate(from.getDate() + idx);
    return day;
  });
}

function getMonthDays(base: Date) {
  const { from, to } = getRange(base, "month");
  const days: Date[] = [];
  const current = new Date(from);
  while (current <= to) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatRange(base: Date, view: "week" | "month") {
  const { from, to } = getRange(base, view);
  return `${from.toLocaleDateString()} - ${to.toLocaleDateString()}`;
}
