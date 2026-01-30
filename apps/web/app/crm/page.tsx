"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";

type CrmTask = {
  id: number;
  title: string;
  dueAt?: string | null;
  completedAt?: string | null;
  relatedCustomerId?: number | null;
  customer?: { id: number; name: string } | null;
};

type Notification = {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  readAt?: string | null;
};

type Segment = {
  id: number;
  name: string;
};

type Customer = {
  id: number;
};

export default function CrmHomePage() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<CrmTask[]>("/crm/tasks?status=pending"),
      api.get<Notification[]>("/crm/notifications"),
      api.get<Segment[]>("/crm/segments"),
      api.get<Customer[]>("/customers"),
    ])
      .then(([taskResp, notifResp, segmentResp, customerResp]) => {
        setTasks(taskResp);
        setNotifications(notifResp);
        setSegments(segmentResp);
        setCustomers(customerResp);
      })
      .catch((err) => setStatus(err.message));
  }, []);

  const now = new Date();
  const overdue = tasks.filter((task) => isOverdue(task.dueAt, now));
  const today = tasks.filter((task) => isSameDay(task.dueAt, now));
  const upcoming = tasks
    .filter((task) => task.dueAt && !isOverdue(task.dueAt, now))
    .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())
    .slice(0, 6);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.readAt).length,
    [notifications],
  );

  async function markRead(id: number) {
    await api.patch(`/crm/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
  }

  return (
    <div className="stack">
      <div className="crm-hero stack">
        <h2>CRM</h2>
        <p className="muted">Resumen rapido de actividad y seguimiento.</p>
        <div className="crm-quick-grid">
          <div className="card stack">
            <span className="muted">Tareas hoy</span>
            <strong>{today.length}</strong>
          </div>
          <div className="card stack">
            <span className="muted">Tareas vencidas</span>
            <strong>{overdue.length}</strong>
          </div>
          <div className="card stack">
            <span className="muted">Alertas</span>
            <strong>{unreadCount}</strong>
          </div>
          <div className="card stack">
            <span className="muted">Segmentos</span>
            <strong>{segments.length}</strong>
          </div>
          <div className="card stack">
            <span className="muted">Clientes</span>
            <strong>{customers.length}</strong>
          </div>
        </div>
      </div>

      <div className="crm-grid-2">
        <div className="card stack">
          <div className="row">
            <strong>Proximas tareas</strong>
            <a href="/crm/tasks" className="button secondary">
              Ver todas
            </a>
          </div>
          {upcoming.length === 0 && (
            <div className="muted">No hay tareas pendientes.</div>
          )}
          {upcoming.map((task) => (
            <div key={task.id} className="crm-timeline-item">
              <div className="row">
                <strong>{task.title}</strong>
                <span className="muted">
                  {task.dueAt ? formatDate(task.dueAt) : "Sin fecha"}
                </span>
              </div>
              {task.customer?.name && (
                <span className="muted">{task.customer.name}</span>
              )}
            </div>
          ))}
        </div>

        <div className="card stack">
          <div className="row">
            <strong>Alertas CRM</strong>
            <span className="muted">{unreadCount} sin leer</span>
          </div>
          {notifications.slice(0, 10).map((notif) => (
            <div key={notif.id} className="crm-timeline-item">
              <div className="row">
                <strong>{notif.message}</strong>
                <span className="muted">{formatDate(notif.createdAt)}</span>
              </div>
              <div className="row">
                <span className="muted">
                  {notif.readAt ? "Leido" : "Sin leer"}
                </span>
                {!notif.readAt && (
                  <button
                    className="secondary"
                    onClick={() => markRead(notif.id)}
                  >
                    Marcar leido
                  </button>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="muted">Sin notificaciones.</div>
          )}
        </div>
      </div>

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

function isOverdue(dateValue: string | null | undefined, ref: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date.getTime() < ref.getTime();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}
