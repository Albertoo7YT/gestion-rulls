"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type WebOrder = {
  wooOrderId: string;
  number: string;
  status: string;
  createdAtWoo: string;
  customerName: string;
  total: string;
  currency: string;
  processedAt?: string | null;
};

type PosOrder = {
  id: number;
  type: string;
  date: string;
  reference?: string | null;
  buyer?: string;
  units?: number;
  total?: number;
};

export default function OrdersPage() {
  const [webOrders, setWebOrders] = useState<WebOrder[]>([]);
  const [posOrders, setPosOrders] = useState<PosOrder[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedMoveId, setSelectedMoveId] = useState<number | null>(null);
  const [selectedMove, setSelectedMove] = useState<any | null>(null);
  const [editReference, setEditReference] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [selectedWebOrders, setSelectedWebOrders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedPosOrders, setSelectedPosOrders] = useState<Set<number>>(
    new Set(),
  );
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:3001";

  useEffect(() => {
    Promise.all([
      api.get<WebOrder[]>("/web-orders"),
      api.get<PosOrder[]>(
        "/moves?types=transfer,b2b_sale,b2c_sale,b2b_return,b2c_return",
      ),
    ])
      .then(([web, moves]) => {
        setWebOrders(web);
        setPosOrders(moves);
        const webIds = new Set(web.map((o) => o.wooOrderId));
        const moveIds = new Set(moves.map((m) => m.id));
        setSelectedWebOrders(
          (prev) =>
            new Set(Array.from(prev).filter((id) => webIds.has(id))),
        );
        setSelectedPosOrders(
          (prev) =>
            new Set(Array.from(prev).filter((id) => moveIds.has(id))),
        );
      })
      .catch((err) => setStatus(err.message));
  }, []);

  const allWebSelected =
    webOrders.length > 0 &&
    webOrders.every((o) => selectedWebOrders.has(o.wooOrderId));
  const allPosSelected =
    posOrders.length > 0 &&
    posOrders.every((o) => selectedPosOrders.has(o.id));

  function toggleWebOrder(id: string) {
    setSelectedWebOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePosOrder(id: number) {
    setSelectedPosOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllWebOrders() {
    setSelectedWebOrders((prev) => {
      const next = new Set(prev);
      if (allWebSelected) {
        webOrders.forEach((o) => next.delete(o.wooOrderId));
      } else {
        webOrders.forEach((o) => next.add(o.wooOrderId));
      }
      return next;
    });
  }

  function toggleAllPosOrders() {
    setSelectedPosOrders((prev) => {
      const next = new Set(prev);
      if (allPosSelected) {
        posOrders.forEach((o) => next.delete(o.id));
      } else {
        posOrders.forEach((o) => next.add(o.id));
      }
      return next;
    });
  }

  async function deleteSelectedWebOrders() {
    if (selectedWebOrders.size === 0) return;
    const ok = window.confirm(
      `Eliminar ${selectedWebOrders.size} pedidos web?`,
    );
    if (!ok) return;
    setStatus(null);
    const ids = Array.from(selectedWebOrders);
    await Promise.all(ids.map((id) => api.del(`/web-orders/${id}`)));
    const refreshed = await api.get<WebOrder[]>("/web-orders");
    setWebOrders(refreshed);
    setSelectedWebOrders(new Set());
  }

  async function deleteSelectedPosOrders() {
    if (selectedPosOrders.size === 0) return;
    const ok = window.confirm(
      `Eliminar ${selectedPosOrders.size} pedidos?`,
    );
    if (!ok) return;
    setStatus(null);
    const ids = Array.from(selectedPosOrders);
    await Promise.all(ids.map((id) => api.del(`/moves/${id}`)));
    const updatedList = await api.get<PosOrder[]>(
      "/moves?types=transfer,b2b_sale,b2c_sale,b2b_return,b2c_return",
    );
    setPosOrders(updatedList);
    setSelectedPosOrders(new Set());
  }

  async function openMove(id: number) {
    setSelectedMoveId(id);
    const data = await api.get<any>(`/moves/${id}`);
    setSelectedMove(data);
    setEditReference(data.reference ?? "");
    setEditNotes(data.notes ?? "");
    setEditDate(data.date ? new Date(data.date).toISOString().slice(0, 10) : "");
  }

  async function saveMove() {
    if (!selectedMoveId) return;
    await api.put(`/moves/${selectedMoveId}`, {
      reference: editReference || undefined,
      notes: editNotes || undefined,
      date: editDate || undefined,
    });
    const refreshed = await api.get<any>(`/moves/${selectedMoveId}`);
    setSelectedMove(refreshed);
    const updatedList = await api.get<PosOrder[]>(
      "/moves?types=transfer,b2b_sale,b2c_sale,b2b_return,b2c_return",
    );
    setPosOrders(updatedList);
  }

  return (
    <div className="stack">
      <h2>Pedidos</h2>
      <div className="card stack">
        <strong>Pedidos web</strong>
        <div className="row bulk-actions">
          <button
            className="secondary"
            type="button"
            onClick={toggleAllWebOrders}
            disabled={webOrders.length === 0}
          >
            {allWebSelected ? "Quitar seleccion" : "Seleccionar todo"}
          </button>
          <span className="muted">{selectedWebOrders.size} seleccionados</span>
          <button
            className="delete-button"
            type="button"
            disabled={selectedWebOrders.size === 0}
            onClick={deleteSelectedWebOrders}
          >
            Eliminar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Numero</th>
              <th>Estado</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {webOrders.map((o) => (
              <tr key={o.wooOrderId}>
                <td className="center-cell">
                  <input
                    type="checkbox"
                    checked={selectedWebOrders.has(o.wooOrderId)}
                    onChange={() => toggleWebOrder(o.wooOrderId)}
                  />
                </td>
                <td>{o.number}</td>
                <td>{o.status}</td>
                <td>{o.customerName}</td>
                <td>
                  {o.total} {o.currency}
                </td>
                <td>{new Date(o.createdAtWoo).toLocaleString()}</td>
              </tr>
            ))}
            {webOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Sin pedidos web
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        <strong>Pedidos (ventas)</strong>
        <div className="row bulk-actions">
          <button
            className="secondary"
            type="button"
            onClick={toggleAllPosOrders}
            disabled={posOrders.length === 0}
          >
            {allPosSelected ? "Quitar seleccion" : "Seleccionar todo"}
          </button>
          <span className="muted">{selectedPosOrders.size} seleccionados</span>
          <button
            className="delete-button"
            type="button"
            disabled={selectedPosOrders.size === 0}
            onClick={deleteSelectedPosOrders}
          >
            Eliminar
          </button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Comprador</th>
              <th>Unidades</th>
              <th>Total</th>
              <th>Fecha</th>
              <th>Informe</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {posOrders.map((m) => (
              <tr key={m.id}>
                <td className="center-cell">
                  <input
                    type="checkbox"
                    checked={selectedPosOrders.has(m.id)}
                    onChange={() => togglePosOrder(m.id)}
                  />
                </td>
                <td>{m.id}</td>
                <td>{m.type}</td>
                <td>{m.reference ?? "-"}</td>
                <td>{m.buyer ?? "-"}</td>
                <td>{m.units ?? 0}</td>
                <td>{m.total?.toFixed(2) ?? "-"}</td>
                <td>{new Date(m.date).toLocaleString()}</td>
                <td>
                  <a
                    className="secondary"
                    href={`${apiBase}/reports/moves/${m.id}/ticket`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ticket
                  </a>{" "}
                  <a
                    className="secondary"
                    href={`${apiBase}/reports/moves/${m.id}/invoice`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Factura
                  </a>
                </td>
                <td className="center-cell">
                  <button className="secondary" onClick={() => openMove(m.id)}>
                    Ver pedido
                  </button>
                </td>
              </tr>
            ))}
            {posOrders.length === 0 && (
              <tr>
                <td colSpan={10} className="muted">
                  Sin pedidos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {selectedMove && (
        <div className="card stack">
          <strong>Pedido {selectedMove.reference ?? `#${selectedMove.id}`}</strong>
          <div className="row">
            <label className="stack">
              <span className="muted">Numero</span>
              <input
                className="input"
                value={editReference}
                onChange={(e) => setEditReference(e.target.value)}
              />
            </label>
            <label className="stack">
              <span className="muted">Fecha</span>
              <input
                className="input"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
              />
            </label>
            <label className="stack">
              <span className="muted">Notas</span>
              <input
                className="input"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </label>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedMove.lines?.map((line: any, index: number) => (
                <tr key={`${line.sku}-${index}`}>
                  <td>{line.sku}</td>
                  <td>{line.product?.name ?? "-"}</td>
                  <td>{line.quantity}</td>
                  <td>{line.unitPrice ?? "-"}</td>
                  <td>
                    {(
                      (line.unitPrice ? Number(line.unitPrice) : 0) *
                      line.quantity
                    ).toFixed(2)}
                  </td>
                </tr>
              ))}
              {!selectedMove.lines?.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    Sin lineas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="row center-actions">
            <button onClick={saveMove}>Guardar cambios</button>
            <button className="secondary" onClick={() => setSelectedMove(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
