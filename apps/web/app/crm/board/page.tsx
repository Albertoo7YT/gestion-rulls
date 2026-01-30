"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "../../../lib/api";

type BoardCard = {
  id: number;
  customerId: number;
  priority: number;
  tags: string[];
  owner: { id: number; username: string } | null;
  customer: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    type?: string | null;
    active?: boolean;
  };
};

type BoardStatus = {
  id: number;
  name: string;
  order: number;
  color?: string | null;
  cards: BoardCard[];
};

type BoardResponse = {
  phaseId?: number;
  statuses: BoardStatus[];
  unassigned: BoardCard[];
};

type Phase = {
  id: number;
  name: string;
  sortOrder: number;
  color?: string | null;
};

type Customer = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: string | null;
};

type Summary = {
  nextTask?: { id: number; title: string; dueAt?: string | null } | null;
  sales?: { lastDate?: string | null };
};

export default function CrmBoardPage() {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [activePhaseId, setActivePhaseId] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<Record<number, Summary>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [taskCustomerId, setTaskCustomerId] = useState<number | null>(null);
  const [newPhaseName, setNewPhaseName] = useState("");
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState("");
  const [moveCustomerId, setMoveCustomerId] = useState<number | null>(null);
  const [movePhaseId, setMovePhaseId] = useState<number | null>(null);
  const [moveStatusId, setMoveStatusId] = useState<number | null>(null);
  const [moveStatuses, setMoveStatuses] = useState<BoardStatus[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [addCustomerStatusId, setAddCustomerStatusId] = useState<number | null>(
    null,
  );
  const [addCustomerQuery, setAddCustomerQuery] = useState("");
  const [addCustomerResults, setAddCustomerResults] = useState<Customer[]>([]);
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const [addCustomerError, setAddCustomerError] = useState<string | null>(null);
  const [addCustomerForm, setAddCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    type: "public",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    type: "call",
    dueAt: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userRaw = localStorage.getItem("auth_user");
    if (userRaw) {
      try {
        const parsed = JSON.parse(userRaw) as { role?: string };
        setRole(parsed.role ?? null);
      } catch {
        setRole(null);
      }
    }
  }, []);

  useEffect(() => {
    loadPhases().catch((err) => setStatus(err.message));
  }, []);

  const filteredBoard = useMemo(() => {
    if (!board) return null;
    if (!tagFilter.trim()) return board;
    const tag = tagFilter.trim().toLowerCase();
    const filterCards = (cards: BoardCard[]) =>
      cards.filter((card) =>
        (card.tags ?? []).some((t) => t.toLowerCase().includes(tag)),
      );
    return {
      statuses: board.statuses.map((status) => ({
        ...status,
        cards: filterCards(status.cards),
      })),
      unassigned: filterCards(board.unassigned),
    };
  }, [board, tagFilter]);

  useEffect(() => {
    if (!activePhaseId) return;
    loadBoard().catch((err) => setStatus(err.message));
  }, [search, ownerFilter, statusFilter, activePhaseId]);

  async function loadPhases() {
    const resp = await api.get<Phase[]>("/crm/phases");
    setPhases(resp);
    if (!activePhaseId && resp.length > 0) {
      setActivePhaseId(resp[0].id);
    }
  }

  async function loadBoard() {
    setLoading(true);
    setStatus(null);
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (ownerFilter) params.set("owner", ownerFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (activePhaseId) params.set("phase", String(activePhaseId));
    const resp = await api.get<BoardResponse>(
      `/crm/board${params.toString() ? `?${params}` : ""}`,
    );
    setBoard(resp);
    setLoading(false);
  }

  async function createPhase() {
    if (!newPhaseName.trim()) return;
    const created = await api.post<Phase>("/crm/phases", {
      name: newPhaseName.trim(),
    });
    setShowPhaseModal(false);
    setNewPhaseName("");
    await loadPhases();
    setActivePhaseId(created.id);
  }

  async function deletePhase() {
    if (!activePhaseId) return;
    if (!confirm("Eliminar fase?")) return;
    await api.del(`/crm/phases/${activePhaseId}`);
    const resp = await api.get<Phase[]>("/crm/phases");
    setPhases(resp);
    setActivePhaseId(resp[0]?.id ?? null);
  }

  async function createStatus() {
    if (!activePhaseId) return;
    if (!newStatusName.trim()) return;
    await api.post("/crm/statuses", {
      name: newStatusName.trim(),
      phaseId: activePhaseId,
      color: newStatusColor.trim() || undefined,
    });
    setShowStatusModal(false);
    setNewStatusName("");
    setNewStatusColor("");
    await loadBoard();
  }

  async function deleteStatus(statusId: number) {
    if (!confirm("Eliminar columna?")) return;
    await api.patch(`/crm/statuses/${statusId}/delete`, {});
    await loadBoard();
  }

  async function loadMoveStatuses(phaseId: number) {
    const resp = await api.get<BoardStatus[]>(`/crm/statuses?phase=${phaseId}`);
    setMoveStatuses(resp);
    if (resp.length > 0) {
      setMoveStatusId(resp[0].id);
    } else {
      setMoveStatusId(null);
    }
  }

  async function openMoveModal(card: BoardCard) {
    const phaseId = activePhaseId;
    if (!phaseId) return;
    setMoveCustomerId(card.customerId);
    setMovePhaseId(phaseId);
    await loadMoveStatuses(phaseId);
  }

  async function moveCustomer() {
    if (!moveCustomerId || !moveStatusId) return;
    await api.post("/crm/board/move", {
      customerId: moveCustomerId,
      toStatusId: moveStatusId,
      toPhaseId: movePhaseId ?? undefined,
    });
    setMoveCustomerId(null);
    await loadBoard();
  }

  async function searchCustomers(query: string) {
    setAddCustomerLoading(true);
    setAddCustomerError(null);
    const params = query.trim()
      ? `?search=${encodeURIComponent(query.trim())}`
      : "";
    try {
      const resp = await api.get<Customer[]>(`/customers${params}`);
      setAddCustomerResults(resp);
    } catch (err) {
      setAddCustomerError(String(err));
      setAddCustomerResults([]);
    } finally {
      setAddCustomerLoading(false);
    }
  }

  async function openAddCustomer(statusId: number) {
    setAddCustomerStatusId(statusId);
    setAddCustomerQuery("");
    setAddCustomerResults([]);
    setAddCustomerError(null);
    setAddCustomerForm({ name: "", email: "", phone: "", type: "public" });
    await searchCustomers("");
  }

  async function addExistingCustomer(customerId: number) {
    if (!addCustomerStatusId) return;
    await api.post("/crm/board/move", {
      customerId,
      toStatusId: addCustomerStatusId,
      toPhaseId: activePhaseId ?? undefined,
    });
    setAddCustomerStatusId(null);
    await loadBoard();
  }

  async function createAndAddCustomer() {
    if (!addCustomerStatusId) return;
    if (!addCustomerForm.name.trim()) return;
    const created = await api.post<Customer>("/customers", {
      type: addCustomerForm.type,
      name: addCustomerForm.name.trim(),
      email: addCustomerForm.email.trim() || undefined,
      phone: addCustomerForm.phone.trim() || undefined,
    });
    await api.post("/crm/board/move", {
      customerId: created.id,
      toStatusId: addCustomerStatusId,
      toPhaseId: activePhaseId ?? undefined,
    });
    setAddCustomerStatusId(null);
    await loadBoard();
  }

  useEffect(() => {
    if (!board) return;
    const allCards = [
      ...board.statuses.flatMap((status) => status.cards),
      ...board.unassigned,
    ];
    const missing = allCards
      .map((card) => card.customerId)
      .filter((id) => !summaries[id]);
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        api
          .get<Summary>(`/crm/customers/${id}/summary`)
          .then((summary) => ({ id, summary }))
          .catch(() => ({ id, summary: {} })),
      ),
    ).then((results) => {
      setSummaries((prev) => {
        const next = { ...prev };
        for (const item of results) {
          next[item.id] = item.summary;
        }
        return next;
      });
    });
  }, [board, summaries]);

  function handleDragStart(
    event: React.DragEvent<HTMLDivElement>,
    card: BoardCard,
    fromStatusId: number,
  ) {
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ customerId: card.customerId, fromStatusId }),
    );
    event.dataTransfer.effectAllowed = "move";
  }

  function allowDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(event: React.DragEvent<HTMLDivElement>, toStatusId: number) {
    event.preventDefault();
    const payload = event.dataTransfer.getData("text/plain");
    if (!payload) return;
    const parsed = JSON.parse(payload) as { customerId: number; fromStatusId: number };
    if (parsed.fromStatusId === toStatusId) return;
    if (!board) return;

    const optimistic = moveCard(board, parsed.customerId, toStatusId);
    setBoard(optimistic);
    try {
      await api.post("/crm/board/move", {
        customerId: parsed.customerId,
        toStatusId,
      });
    } catch (err: any) {
      setStatus(err.message ?? "No se pudo mover");
      await loadBoard();
    }
  }

  function moveCard(current: BoardResponse, customerId: number, toStatusId: number) {
    const clone: BoardResponse = {
      statuses: current.statuses.map((status) => ({
        ...status,
        cards: status.cards.filter((card) => card.customerId !== customerId),
      })),
      unassigned: current.unassigned.filter((card) => card.customerId !== customerId),
    };

    let moved: BoardCard | undefined;
    for (const status of current.statuses) {
      const found = status.cards.find((card) => card.customerId === customerId);
      if (found) moved = found;
    }
    if (!moved) {
      moved = current.unassigned.find((card) => card.customerId === customerId);
    }
    if (!moved) return current;

    const target = clone.statuses.find((status) => status.id === toStatusId);
    if (target) {
      target.cards = [moved, ...target.cards];
    }
    return clone;
  }

  async function createTask() {
    if (!taskCustomerId) return;
    if (!taskForm.title.trim()) return;
    const dueAtValue =
      taskForm.dueAt || toLocalInput(new Date().toISOString());
    await api.post("/crm/tasks", {
      relatedCustomerId: taskCustomerId,
      title: taskForm.title.trim(),
      type: taskForm.type,
      dueAt: dueAtValue,
    });
    setTaskCustomerId(null);
    setTaskForm({ title: "", type: "call", dueAt: "" });
    await loadBoard();
  }

  return (
    <div className="stack">
      <h2>Tablero CRM</h2>

      <div className="card stack crm-board-controls">
        <div className="row crm-board-controls-row" style={{ justifyContent: "space-between" }}>
          <div className="row crm-board-controls-fases">
            <div className="muted">Fases</div>
            {role === "admin" && (
              <>
                <button
                  className="secondary"
                  onClick={() => setShowPhaseModal(true)}
                >
                  Nueva fase
                </button>
                <button className="secondary crm-delete-btn" onClick={deletePhase}>
                  Eliminar fase
                </button>
              </>
            )}
          </div>
          <button className="secondary crm-board-refresh" onClick={loadBoard}>
            Refrescar
          </button>
        </div>
        <div className="stack crm-board-phases-section">
          <div className="muted crm-phases-label">Fases</div>
          <div className="crm-board-phases">
            {phases.map((item) => (
              <button
                key={item.id}
                className={`tab-button ${activePhaseId === item.id ? "active" : ""}`}
                onClick={() => setActivePhaseId(item.id)}
              >
                {item.name}
              </button>
            ))}
            {phases.length === 0 && <span className="muted">Sin fases</span>}
            {role === "admin" && null}
          </div>
        </div>
        <div className="stack crm-board-columns-section">
          <div className="row crm-board-controls-row" style={{ justifyContent: "space-between" }}>
            <div className="row crm-board-controls-columns">
              <div className="muted">Columnas</div>
              {role === "admin" && (
                <button
                  className="secondary"
                  onClick={() => setShowStatusModal(true)}
                >
                  Nueva columna
                </button>
              )}
            </div>
          </div>
          <div className="row crm-board-statuses">
            {board?.statuses.map((item) => (
              <div className="crm-column-chip" key={item.id}>
                <span>{item.name}</span>
                {role === "admin" && (
                  <button
                    className="chip-remove crm-delete-btn"
                    onClick={() => deleteStatus(item.id)}
                    aria-label="Eliminar columna"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {(!board || board.statuses.length === 0) && (
              <span className="muted">Sin columnas</span>
            )}
          </div>
        </div>
        {loading && <span className="muted">Cargando tablero...</span>}
      </div>

      <div className="crm-board">
        {filteredBoard?.statuses.map((statusCol) => (
          <div
            key={statusCol.id}
            className="crm-column"
            onDragOver={allowDrop}
            onDrop={(event) => handleDrop(event, statusCol.id)}
          >
            <div className="crm-column-header">
              <span className="crm-column-title">{statusCol.name}</span>
              <span className="muted">{statusCol.cards.length}</span>
            </div>
            <div className="crm-column-cards">
              {statusCol.cards.map((card) => {
                const summary = summaries[card.customerId];
                const nextTask = summary?.nextTask;
                const lastPurchase = summary?.sales?.lastDate;
                return (
                  <div
                    key={card.id}
                    className="crm-card"
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(event, card, statusCol.id)
                    }
                  >
                    <div className="crm-card-header">
                      <div className="crm-card-title">{card.customer.name}</div>
                      <button
                        className="ghost"
                        onClick={() => {
                          setTaskCustomerId(card.customerId);
                          setTaskForm({
                            title: "",
                            type: "call",
                            dueAt: toLocalInput(new Date().toISOString()),
                          });
                        }}
                      >
                        Nueva tarea
                      </button>
                    </div>
                    <div className="crm-card-meta">
                      {card.owner?.username && (
                        <span>Resp: {card.owner.username}</span>
                      )}
                      {nextTask?.title && (
                        <span>Prox tarea: {nextTask.title}</span>
                      )}
                      {lastPurchase && (
                        <span>
                          Ult compra: {new Date(lastPurchase).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="crm-card-actions">
                      {card.tags?.map((tag) => (
                        <span className="crm-pill" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="crm-card-actions">
                      <a
                        className="button secondary"
                        href={`/crm/customers/${card.customerId}`}
                      >
                        Abrir ficha
                      </a>
                      <button
                        className="secondary"
                        onClick={() => openMoveModal(card)}
                      >
                        Mover
                      </button>
                    </div>
                  </div>
                );
              })}
              <button
                className="ghost crm-add-card"
                onClick={(event) => {
                  event.stopPropagation();
                  openAddCustomer(statusCol.id);
                }}
              >
                + Cliente
              </button>
            </div>
          </div>
        ))}
      </div>

      {taskCustomerId && (
        <div className="modal-backdrop" onClick={() => setTaskCustomerId(null)}>
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Nueva tarea</strong>
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
            </div>
            <div className="row">
              <button onClick={createTask}>Crear</button>
              <button className="secondary" onClick={() => setTaskCustomerId(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {addCustomerStatusId && (
        <div
          className="modal-backdrop"
          onClick={() => setAddCustomerStatusId(null)}
        >
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Agregar cliente</strong>
            <label className="stack">
              <span className="muted">Buscar cliente</span>
              <input
                className="input"
                placeholder="Nombre, email, telefono"
                value={addCustomerQuery}
                onChange={(e) => {
                  const next = e.target.value;
                  setAddCustomerQuery(next);
                  searchCustomers(next);
                }}
              />
            </label>
            {addCustomerLoading && <span className="muted">Buscando...</span>}
            {addCustomerError && (
              <span className="muted">{addCustomerError}</span>
            )}
            <div className="stack">
              {addCustomerResults.slice(0, 8).map((customer) => (
                <button
                  key={customer.id}
                  className="secondary"
                  onClick={() => addExistingCustomer(customer.id)}
                >
                  {customer.name}
                  {customer.email ? ` · ${customer.email}` : ""}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </button>
              ))}
              {addCustomerResults.length === 0 && !addCustomerLoading && (
                <span className="muted">Sin resultados</span>
              )}
            </div>
            <div className="card stack">
              <strong>Crear cliente rapido</strong>
              <div className="row">
                <label className="stack">
                  <span className="muted">Tipo</span>
                  <select
                    className="input"
                    value={addCustomerForm.type}
                    onChange={(e) =>
                      setAddCustomerForm({
                        ...addCustomerForm,
                        type: e.target.value,
                      })
                    }
                  >
                    <option value="public">Publico</option>
                    <option value="b2b">B2B</option>
                  </select>
                </label>
                <label className="stack">
                  <span className="muted">Nombre</span>
                  <input
                    className="input"
                    value={addCustomerForm.name}
                    onChange={(e) =>
                      setAddCustomerForm({
                        ...addCustomerForm,
                        name: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Email</span>
                  <input
                    className="input"
                    value={addCustomerForm.email}
                    onChange={(e) =>
                      setAddCustomerForm({
                        ...addCustomerForm,
                        email: e.target.value,
                      })
                    }
                  />
                </label>
                <label className="stack">
                  <span className="muted">Telefono</span>
                  <input
                    className="input"
                    value={addCustomerForm.phone}
                    onChange={(e) =>
                      setAddCustomerForm({
                        ...addCustomerForm,
                        phone: e.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="row">
                <button onClick={createAndAddCustomer}>Crear y anadir</button>
                <button
                  className="secondary"
                  onClick={() => setAddCustomerStatusId(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPhaseModal && (
        <div className="modal-backdrop" onClick={() => setShowPhaseModal(false)}>
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Nueva fase</strong>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
              />
            </label>
            <div className="row">
              <button onClick={createPhase}>Crear</button>
              <button className="secondary" onClick={() => setShowPhaseModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && (
        <div className="modal-backdrop" onClick={() => setShowStatusModal(false)}>
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Nueva columna</strong>
            <label className="stack">
              <span className="muted">Nombre</span>
              <input
                className="input"
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
              />
            </label>
            <label className="stack">
              <span className="muted">Color (opcional)</span>
              <input
                className="input"
                value={newStatusColor}
                onChange={(e) => setNewStatusColor(e.target.value)}
              />
            </label>
            <div className="row">
              <button onClick={createStatus}>Crear</button>
              <button className="secondary" onClick={() => setShowStatusModal(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {moveCustomerId && (
        <div className="modal-backdrop" onClick={() => setMoveCustomerId(null)}>
          <div className="card stack modal-card" onClick={(e) => e.stopPropagation()}>
            <strong>Mover cliente</strong>
            <div className="row">
              <label className="stack">
                <span className="muted">Fase</span>
                <select
                  className="input"
                  value={movePhaseId ?? ""}
                  onChange={(e) => {
                    const nextPhase = Number(e.target.value);
                    setMovePhaseId(nextPhase);
                    loadMoveStatuses(nextPhase).catch((err) =>
                      setStatus(err.message),
                    );
                  }}
                >
                  {phases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="stack">
                <span className="muted">Estado</span>
                <select
                  className="input"
                  value={moveStatusId ?? ""}
                  onChange={(e) => setMoveStatusId(Number(e.target.value))}
                >
                  {moveStatuses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              <button onClick={moveCustomer}>Mover</button>
              <button className="secondary" onClick={() => setMoveCustomerId(null)}>
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
