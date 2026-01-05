"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type AuditRow = {
  id: number;
  method: string;
  path: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  statusCode?: number | null;
  createdAt: string;
  user?: { email: string; username: string };
};

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditRow[]>("/audit?limit=200")
      .then(setRows)
      .catch((err) => setStatus(err.message));
  }, []);

  return (
    <div className="stack">
      <h2>Historial de cambios</h2>
      <div className="card stack">
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Accion</th>
              <th>Entidad</th>
              <th>ID</th>
              <th>Ruta</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.user?.username ?? row.user?.email ?? "-"}</td>
                <td>{row.action}</td>
                <td>{row.entity ?? "-"}</td>
                <td>{row.entityId ?? "-"}</td>
                <td>
                  {row.method} {row.path}
                </td>
                <td>{row.statusCode ?? "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Sin cambios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
