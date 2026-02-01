"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

type WooSettings = {
  wooSyncEnabled: boolean;
  wooStockWarehouseIds: number[];
  lastWooSyncAt: string | null;
  wooBaseUrl?: string | null;
  wooConsumerKey?: string | null;
  wooConsumerSecret?: string | null;
  wooSyncProducts?: boolean;
  wooSyncImages?: boolean;
};

type Location = { id: number; name: string; type: "warehouse" | "retail" };

export default function WooSettingsPage() {
  const [settings, setSettings] = useState<WooSettings | null>(null);
  const [warehouses, setWarehouses] = useState<Location[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<
    "success" | "error" | "info"
  >("info");
  const [importOptions, setImportOptions] = useState({
    importOrders: true,
    importProducts: false,
    importImages: false,
    importPrices: false,
    importCategories: false,
    importWarehouseId: undefined as number | undefined,
    includePending: false,
  });
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportElapsed, setExportElapsed] = useState(0);
  const [testLoading, setTestLoading] = useState(false);

  async function loadData() {
    const [settingsData, warehouseData] = await Promise.all([
      api.get<WooSettings>("/settings/woo"),
      api.get<Location[]>("/locations?type=warehouse"),
    ]);
    const validIds = new Set(warehouseData.map((w) => w.id));
    const filteredIds = settingsData.wooStockWarehouseIds.filter((id) =>
      validIds.has(id),
    );
    setSettings({
      ...settingsData,
      wooStockWarehouseIds: filteredIds,
    });
    setWarehouses(warehouseData);
  }

  useEffect(() => {
    loadData().catch((err) => setStatus(err.message));
  }, []);

  useEffect(() => {
    if (!exportLoading) {
      setExportElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setExportElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [exportLoading]);

  async function saveCredentials() {
    if (!settings) return;
    setStatus(null);
    setStatusKind("info");
    const updated = await api.put<WooSettings>("/settings/woo", {
      wooBaseUrl: settings.wooBaseUrl ?? "",
      wooConsumerKey: settings.wooConsumerKey ?? "",
      wooConsumerSecret: settings.wooConsumerSecret ?? "",
    });
    setSettings({
      ...settings,
      wooBaseUrl: updated.wooBaseUrl ?? null,
      wooConsumerKey: updated.wooConsumerKey ?? null,
      wooConsumerSecret: updated.wooConsumerSecret ?? null,
    });
  }

  async function saveWooOptions() {
    if (!settings) return;
    setStatus(null);
    setStatusKind("info");
    const validIds = new Set(warehouses.map((w) => w.id));
    const filteredIds = settings.wooStockWarehouseIds.filter((id) =>
      validIds.has(id),
    );
    const updated = await api.put<WooSettings>("/settings/woo", {
      wooSyncEnabled: settings.wooSyncEnabled,
      wooStockWarehouseIds: filteredIds,
    });
    setSettings(updated);
  }

  async function importFromWoo() {
    setStatus("Cargando...");
    setStatusKind("info");
    setImportLoading(true);
    try {
      const res = await api.post<{
        orders?: { imported: number };
        products?: { imported: number; updated: number; skipped: number };
      }>("/woo/import", importOptions);
      const parts = [];
      if (res.orders) {
        parts.push(`Pedidos importados: ${res.orders.imported}`);
      }
      if (res.products) {
        parts.push(
          `Productos: ${res.products.imported} nuevos, ${res.products.updated} actualizados, ${res.products.skipped} omitidos`,
        );
      }
      setStatus(parts.length ? parts.join(" | ") : "Import completado");
      setStatusKind("success");
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message || "Error de import");
    } finally {
      setImportLoading(false);
    }
  }

  async function exportStock() {
    setStatus("Cargando...");
    setStatusKind("info");
    setExportLoading(true);
    if (!settings?.wooStockWarehouseIds.length) {
      setStatus("Selecciona almacenes para exportar stock");
      setStatusKind("error");
      setExportLoading(false);
      return;
    }
    try {
      const res = await api.post<{ updated: number; skipped: number }>(
        "/woo/export-stock",
        { warehouseIds: settings.wooStockWarehouseIds },
      );
      setStatus(`Stock exportado: ${res.updated} ok, ${res.skipped} omitidos`);
      setStatusKind("success");
    } catch (err) {
      setStatusKind("error");
      setStatus((err as Error).message || "Error de export");
    } finally {
      setExportLoading(false);
    }
  }

  async function testConnection() {
    setStatus("Cargando...");
    setStatusKind("info");
    setTestLoading(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>(
        "/woo/test-connection",
        {},
      );
      setStatus(res.ok ? "Conectado" : "Error de conexion");
      setStatusKind(res.ok ? "success" : "error");
    } catch {
      setStatus("Error de conexion");
      setStatusKind("error");
    } finally {
      setTestLoading(false);
    }
  }

  function toggleWarehouse(id: number) {
    if (!settings) return;
    const current = new Set(settings.wooStockWarehouseIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    setSettings({
      ...settings,
      wooStockWarehouseIds: Array.from(current),
    });
  }

  return (
    <div className="stack">
      <h2>Woo Settings</h2>
      {settings && (
        <div className="card stack">
          <div className="stack">
            <strong>Credenciales Woo</strong>
            <label className="stack">
              <span className="muted">Woo Base URL</span>
              <input
                className="input"
                placeholder="https://tu-tienda.com"
                value={settings.wooBaseUrl ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, wooBaseUrl: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Woo Consumer Key</span>
              <input
                className="input"
                value={settings.wooConsumerKey ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, wooConsumerKey: e.target.value })
                }
              />
            </label>
            <label className="stack">
              <span className="muted">Woo Consumer Secret</span>
              <input
                className="input"
                type="password"
                value={settings.wooConsumerSecret ?? ""}
                onChange={(e) =>
                  setSettings({ ...settings, wooConsumerSecret: e.target.value })
                }
              />
            </label>
            <div className="row">
              <button onClick={saveCredentials} disabled={testLoading}>
                Guardar credenciales
              </button>
              <button
                className="secondary"
                onClick={testConnection}
                disabled={testLoading}
              >
                {testLoading ? "Probando..." : "Test conexion"}
              </button>
            </div>
          </div>

          <label className="row">
            <input
              type="checkbox"
              checked={settings.wooSyncEnabled}
              onChange={(e) =>
                setSettings({ ...settings, wooSyncEnabled: e.target.checked })
              }
            />
            Woo sync enabled
          </label>

          <div className="card stack">
            <strong>Importar desde Woo</strong>
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.importOrders}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    importOrders: e.target.checked,
                  })
                }
              />
              Importar pedidos
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.includePending}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    includePending: e.target.checked,
                  })
                }
              />
              Incluir pendientes
            </label>
            {importOptions.importOrders && (
              <label className="stack">
                <span className="muted">Almacen para pedidos</span>
                <select
                  className="input"
                  value={importOptions.importWarehouseId ?? ""}
                  onChange={(e) =>
                    setImportOptions({
                      ...importOptions,
                      importWarehouseId: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                >
                  <option value="">Sin asignar</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.importProducts}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    importProducts: e.target.checked,
                  })
                }
              />
              Importar productos
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.importImages}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    importImages: e.target.checked,
                  })
                }
              />
              Importar fotos
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.importPrices}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    importPrices: e.target.checked,
                  })
                }
              />
              Importar precios
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={importOptions.importCategories}
                onChange={(e) =>
                  setImportOptions({
                    ...importOptions,
                    importCategories: e.target.checked,
                  })
                }
              />
              Importar categorias
            </label>
            <div className="row">
              <button
                className="secondary"
                onClick={importFromWoo}
                disabled={importLoading}
              >
                {importLoading ? "Importando..." : "Importar ahora"}
              </button>
            </div>
          </div>

          <div className="card stack">
            <strong>Exportar a Woo</strong>
            <p className="muted">Selecciona almacenes y exporta stock.</p>
            <div className="stack">
              <strong>Almacenes para stock Woo</strong>
              {warehouses.map((w) => (
                <label className="row" key={w.id}>
                  <input
                    type="checkbox"
                    checked={settings.wooStockWarehouseIds.includes(w.id)}
                    onChange={() => toggleWarehouse(w.id)}
                  />
                  {w.name}
                </label>
              ))}
            </div>
            <div className="row">
              <button
                className="secondary"
                onClick={exportStock}
                disabled={exportLoading}
              >
                {exportLoading ? "Exportando..." : "Exportar stock"}
              </button>
              <button
                className="secondary"
                onClick={saveWooOptions}
                disabled={exportLoading}
              >
                Guardar ajustes Woo
              </button>
            </div>
            {exportLoading && (
              <div className="stack">
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.12)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(95, 8 + exportElapsed * 2)}%`,
                      height: "100%",
                      background: "var(--accent)",
                      transition: "width 0.8s linear",
                    }}
                  />
                </div>
                <p className="muted">
                  Exportando stock... {exportElapsed}s
                </p>
              </div>
            )}
          </div>

          <p className="muted">
            Ultimo sync: {settings.lastWooSyncAt ?? "nunca"}
          </p>
        </div>
      )}
      {!settings && <p className="muted">Cargando...</p>}
      {status && (
        <p
          className={
            statusKind === "success"
              ? "status-success"
              : statusKind === "error"
              ? "status-error"
              : "muted"
          }
        >
          {status}
        </p>
      )}
    </div>
  );
}
