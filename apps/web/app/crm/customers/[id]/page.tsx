"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../lib/api";

type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
  active?: boolean;
  notes?: string | null;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  province?: string | null;
  city?: string | null;
  country?: string | null;
};

type CrmStatus = { id: number; name: string; color?: string | null };

type Summary = {
  customer: Customer;
  crmStatus?: CrmStatus | null;
  crmOwner?: { id: number; username: string } | null;
  nextTask?: { id: number; title: string; dueAt?: string | null } | null;
  lastInteractions?: { type: string; at: string; content: string }[];
  sales?: { total?: number; count?: number; lastDate?: string | null };
};

type OrderRow = {
  id: number;
  type: string;
  reference?: string | null;
  seriesCode?: string | null;
  seriesYear?: number | null;
  seriesNumber?: number | null;
  date: string;
  total: number;
};

type TimelineItem = {
  type: string;
  id: number;
  at: string;
  content: string;
  owner?: string | null;
  done?: boolean;
};

type Task = {
  id: number;
  title: string;
  dueAt?: string | null;
  completedAt?: string | null;
  priority?: number | null;
};

type BoardResponse = {
  statuses: { id: number; name: string }[];
};

type DepositDetail = {
  retail?: { id: number; name: string } | null;
  items: { sku: string; name: string; quantity: number; cost: number }[];
};

export default function CrmCustomerPage() {
  const params = useParams();
  const customerId = Number(params.id);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<CrmStatus[]>([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [status, setStatus] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [depositDetail, setDepositDetail] = useState<DepositDetail | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [moveStatusId, setMoveStatusId] = useState("");
  const [createOrderForm, setCreateOrderForm] = useState({
    warehouseId: "",
    sku: "",
    quantity: "1",
    unitPrice: "",
    paymentMethod: "",
  });
  const customerTypeLabel = (type?: string | null) =>
    type?.toLowerCase() === "b2b" ? "B2B" : "Publico";

  useEffect(() => {
    if (!customerId) return;
    Promise.all([
      api.get<Summary>(`/crm/customers/${customerId}/summary`),
      api.get<TimelineItem[]>(`/crm/customers/${customerId}/timeline`),
      api.get<Task[]>(`/crm/tasks?status=pending&q=`),
      api.get<OrderRow[]>(`/crm/customers/${customerId}/orders`),
      api.get<BoardResponse>("/crm/board"),
    ])
      .then(([summaryResp, timelineResp, taskResp, ordersResp, boardResp]) => {
        setSummary(summaryResp);
        setTimeline(timelineResp);
        setTasks(taskResp.filter((t) => t.completedAt === null));
        setOrders(ordersResp);
        setStatuses(boardResp.statuses as CrmStatus[]);
      })
      .catch((err) => setStatus(err.message));

    api
      .get<DepositDetail>(`/deposits/customers/${customerId}`)
      .then((detail) => setDepositDetail(detail))
      .catch(() => setDepositDetail(null));
  }, [customerId]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.completedAt),
    [tasks],
  );

  async function addNote() {
    if (!noteContent.trim()) return;
    await api.post(`/crm/customers/${customerId}/notes`, {
      content: noteContent.trim(),
    });
    setNoteContent("");
    const updated = await api.get<TimelineItem[]>(
      `/crm/customers/${customerId}/timeline`,
    );
    setTimeline(updated);
  }

  async function createTask() {
    if (!taskTitle.trim()) return;
    await api.post("/crm/tasks", {
      relatedCustomerId: customerId,
      title: taskTitle.trim(),
      type: "call",
    });
    setTaskTitle("");
    const refreshed = await api.get<Task[]>(`/crm/tasks?status=pending`);
    setTasks(refreshed);
  }

  async function moveStatus() {
    if (!moveStatusId) return;
    await api.post("/crm/board/move", {
      customerId,
      toStatusId: Number(moveStatusId),
    });
    const updated = await api.get<Summary>(`/crm/customers/${customerId}/summary`);
    setSummary(updated);
  }

  async function createOrder() {
    if (!createOrderForm.warehouseId || !createOrderForm.sku) return;
    await api.post(`/crm/customers/${customerId}/create-order`, {
      warehouseId: Number(createOrderForm.warehouseId),
      paymentMethod: createOrderForm.paymentMethod || undefined,
      lines: [
        {
          sku: createOrderForm.sku,
          quantity: Number(createOrderForm.quantity) || 1,
          unitPrice: createOrderForm.unitPrice
            ? Number(createOrderForm.unitPrice)
            : undefined,
        },
      ],
    });
    const updated = await api.get<TimelineItem[]>(
      `/crm/customers/${customerId}/timeline`,
    );
    setTimeline(updated);
  }

  if (!summary) {
    return <div className="muted">Cargando...</div>;
  }

  return (
    <div className="stack">
      <h2>{summary.customer.name}</h2>

      <div className="card stack">
        <div className="row crm-tabs">
          <button
            className={`tab-button ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            Resumen
          </button>
          <button
            className={`tab-button ${activeTab === "activity" ? "active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            Actividad
          </button>
          <button
            className={`tab-button ${activeTab === "sales" ? "active" : ""}`}
            onClick={() => setActiveTab("sales")}
          >
            Ventas ERP
          </button>
          <button
            className={`tab-button ${activeTab === "crm" ? "active" : ""}`}
            onClick={() => setActiveTab("crm")}
          >
            CRM
          </button>
        </div>
      </div>

      {activeTab === "summary" && (
        <div className="crm-grid-2">
          <div className="card stack">
            <strong>Estado CRM</strong>
            <div className="row">
              <span className="crm-pill">
                {summary.crmStatus?.name ?? "Sin estado"}
              </span>
              {summary.crmOwner?.username && (
                <span className="muted">Resp: {summary.crmOwner.username}</span>
              )}
            </div>
            {summary.nextTask?.title && (
              <div className="muted">Proxima tarea: {summary.nextTask.title}</div>
            )}
            <div className="row">
              <button className="secondary" onClick={createTask}>
                Crear tarea
              </button>
              <button className="secondary" onClick={addNote}>
                Añadir nota
              </button>
            </div>
          </div>
          <div className="card stack">
            <strong>Acciones rapidas</strong>
            <label className="stack">
              <span className="muted">Mover estado</span>
              <select
                className="input"
                value={moveStatusId}
                onChange={(e) => setMoveStatusId(e.target.value)}
              >
                <option value="">Seleccionar</option>
                {statuses.map((statusItem) => (
                  <option key={statusItem.id} value={statusItem.id}>
                    {statusItem.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={moveStatus}>Mover</button>
            <div className="stack">
              <strong>Crear pedido</strong>
              <div className="row">
                <input
                  className="input"
                  placeholder="Almacen"
                  value={createOrderForm.warehouseId}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      warehouseId: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="SKU"
                  value={createOrderForm.sku}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      sku: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="Cantidad"
                  value={createOrderForm.quantity}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      quantity: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="Precio"
                  value={createOrderForm.unitPrice}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      unitPrice: e.target.value,
                    })
                  }
                />
                <input
                  className="input"
                  placeholder="Metodo pago"
                  value={createOrderForm.paymentMethod}
                  onChange={(e) =>
                    setCreateOrderForm({
                      ...createOrderForm,
                      paymentMethod: e.target.value,
                    })
                  }
                />
              </div>
              <button className="secondary" onClick={createOrder}>
                Crear pedido
              </button>
            </div>
          </div>
          <div className="card stack">
            <strong>Datos del cliente</strong>
            <div className="stack">
              <div>
                <span className="muted">Tipo: </span>
                <strong>{customerTypeLabel(summary.customer.type)}</strong>
              </div>
              <div>
                <span className="muted">NIF: </span>
                <strong>{summary.customer.taxId ?? "-"}</strong>
              </div>
              <div>
                <span className="muted">Email: </span>
                <strong>{summary.customer.email ?? "-"}</strong>
              </div>
              <div>
                <span className="muted">Telefono: </span>
                <strong>{summary.customer.phone ?? "-"}</strong>
              </div>
              <div>
                <span className="muted">Direccion: </span>
                <strong>
                  {summary.customer.addressLine1 ?? "-"}
                  {summary.customer.addressLine2
                    ? ` ${summary.customer.addressLine2}`
                    : ""}
                </strong>
              </div>
              <div>
                <span className="muted">Ciudad: </span>
                <strong>
                  {[
                    summary.customer.postalCode,
                    summary.customer.city,
                    summary.customer.province,
                  ]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </strong>
              </div>
              <div>
                <span className="muted">Pais: </span>
                <strong>{summary.customer.country ?? "-"}</strong>
              </div>
              {summary.customer.notes && (
                <div>
                  <span className="muted">Notas: </span>
                  <strong>{summary.customer.notes}</strong>
                </div>
              )}
            </div>
          </div>
          <div className="card stack">
            <strong>Deposito</strong>
            {depositDetail?.items?.length ? (
              <>
                <div className="muted">
                  Tienda: {depositDetail.retail?.name ?? summary.customer.name}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nombre</th>
                      <th>Uds</th>
                      <th>Coste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {depositDetail.items.map((item) => (
                      <tr key={item.sku}>
                        <td>{item.sku}</td>
                        <td>{item.name}</td>
                        <td>{item.quantity}</td>
                        <td>{(item.cost * item.quantity).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <div className="muted">Sin unidades en deposito.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="card stack">
          <strong>Timeline</strong>
          <div className="crm-timeline">
            {timeline.map((item) => (
              <div key={`${item.type}-${item.id}`} className="crm-timeline-item">
                <strong>{item.type.toUpperCase()}</strong>
                <div>{item.content}</div>
                <div className="muted">
                  {new Date(item.at).toLocaleString()}
                </div>
              </div>
            ))}
            {timeline.length === 0 && <div className="muted">Sin actividad.</div>}
          </div>
        </div>
      )}

      {activeTab === "sales" && (
        <div className="card stack">
          <strong>Ventas ERP</strong>
          <div className="row">
            <div className="card">
              <div className="muted">Total</div>
              <div className="kpi-value">{summary.sales?.total ?? 0} EUR</div>
            </div>
            <div className="card">
              <div className="muted">Pedidos</div>
              <div className="kpi-value">{summary.sales?.count ?? 0}</div>
            </div>
            <div className="card">
              <div className="muted">Ultima compra</div>
              <div className="kpi-value">
                {summary.sales?.lastDate
                  ? new Date(summary.sales.lastDate).toLocaleDateString()
                  : "-"}
              </div>
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Serie</th>
                <th>Numero</th>
                <th>Total</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.id}</td>
                  <td>{order.type}</td>
                  <td>{order.seriesCode ?? "-"}</td>
                  <td>{order.reference ?? "-"}</td>
                  <td>{order.total.toFixed(2)}</td>
                  <td>{new Date(order.date).toLocaleString()}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    Sin pedidos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <a className="button secondary" href="/orders">
            Ver pedidos en Ventas
          </a>
        </div>
      )}

      {activeTab === "crm" && (
        <div className="crm-grid-2">
          <div className="card stack">
            <strong>Tareas abiertas</strong>
            {openTasks.map((task) => (
              <div key={task.id} className="crm-timeline-item">
                <strong>{task.title}</strong>
                <div className="muted">
                  {task.dueAt ? new Date(task.dueAt).toLocaleString() : "Sin fecha"}
                </div>
              </div>
            ))}
            {openTasks.length === 0 && (
              <div className="muted">No hay tareas abiertas.</div>
            )}
          </div>
          <div className="card stack">
            <strong>Etiquetas / Segmentos</strong>
            <div className="muted">
              Etiquetas y segmentos se gestionan desde tablero/segmentos.
            </div>
          </div>
        </div>
      )}

      {status && <p className="muted">{status}</p>}
    </div>
  );
}
