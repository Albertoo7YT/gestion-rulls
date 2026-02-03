"use client";

import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "../lib/api";

const LOGO_URL =
  "https://rulls.eu/wp-content/uploads/2025/12/Rulls-Eslogan-Blanco.png";

export default function AuthShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [role, setRole] = useState<string | null>(null);
  const [crmBadge, setCrmBadge] = useState(0);
  const authBypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";

  const openCrm = pathname.startsWith("/crm");
  const openCatalogo =
    pathname.startsWith("/products") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/categories");
  const openAlmacenes =
    pathname.startsWith("/locations") ||
    pathname.startsWith("/stock") ||
    pathname.startsWith("/purchases") ||
    pathname.startsWith("/suppliers");
  const openVentas =
    pathname.startsWith("/orders") ||
    pathname.startsWith("/web-orders") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/deposits");
  const openClientes = pathname.startsWith("/customers");
  const openAjustes =
    pathname.startsWith("/settings") ||
    pathname.startsWith("/settings/woo") ||
    pathname.startsWith("/settings/pricing") ||
    pathname.startsWith("/settings/users");

  function handleNavClick(href: string) {
    return (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      router.push(href);
      const navToggle = document.getElementById("nav-toggle") as
        | HTMLInputElement
        | null;
      if (navToggle) navToggle.checked = false;
    };
  }

  useEffect(() => {
    if (authBypass) {
      setAuthed(true);
      setRole("admin");
      const saved =
        typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      if (saved === "light" || saved === "dark") {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      } else {
        document.documentElement.dataset.theme = "dark";
      }
      setReady(true);
      return;
    }
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    setAuthed(Boolean(token));
    const storedUser =
      typeof window !== "undefined" ? localStorage.getItem("auth_user") : null;
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as { role?: string } | null;
        setRole(parsed?.role ?? null);
      } catch {
        setRole(null);
      }
    } else {
      setRole(null);
    }
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
    setReady(true);
  }, [pathname, authBypass]);

  const isLogin = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    if (!ready || authBypass) return;
    if (!authed && !isLogin) {
      router.replace("/login");
    }
    if (authed && isLogin) {
      router.replace("/");
    }
    if (authed && role && pathname.startsWith("/crm")) {
      const isCrmAllowed = ["admin", "commercial", "store", "warehouse"].includes(
        role,
      );
      if (!isCrmAllowed) {
        router.replace("/");
        return;
      }
      if (["store", "warehouse"].includes(role)) {
        const allowed =
          pathname === "/crm/board" || pathname.startsWith("/crm/customers/");
        if (!allowed) {
          router.replace("/crm/board");
        }
      }
      if (pathname.startsWith("/crm/settings") && role !== "admin") {
        router.replace("/crm/board");
      }
    }
  }, [authed, isLogin, ready, router, pathname, role, authBypass]);

  useEffect(() => {
    if (!ready || !authed || isLogin || authBypass) return;
    if (!role || !["admin", "commercial", "store", "warehouse"].includes(role)) {
      setCrmBadge(0);
      return;
    }
    Promise.all([
      api.get<
        {
          id: number;
          dueAt?: string | null;
          completedAt?: string | null;
        }[]
      >("/crm/tasks?status=pending"),
      api.get<{ id: number; readAt?: string | null }[]>("/crm/notifications"),
    ])
      .then(([taskResp, notifResp]) => {
        const now = new Date();
        const overdue = taskResp.filter((task) => {
          if (!task.dueAt) return false;
          return new Date(task.dueAt).getTime() < now.getTime();
        }).length;
        const today = taskResp.filter((task) => {
          if (!task.dueAt) return false;
          const due = new Date(task.dueAt);
          return (
            due.getFullYear() === now.getFullYear() &&
            due.getMonth() === now.getMonth() &&
            due.getDate() === now.getDate()
          );
        }).length;
        const unread = notifResp.filter((item) => !item.readAt).length;
        setCrmBadge(overdue + today + unread);
      })
      .catch(() => setCrmBadge(0));
  }, [authed, isLogin, ready, role]);

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthed(false);
    setRole(null);
    router.replace("/login");
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.dataset.theme = next;
  }

  if (!ready) {
    return <div className="login-shell" />;
  }

  if (isLogin) {
    return <div className="login-shell">{children}</div>;
  }

  if (!authed) {
    return <div className="login-shell" />;
  }

  return (
    <>
      <input id="nav-toggle" className="nav-toggle" type="checkbox" />
      <label htmlFor="nav-toggle" className="nav-backdrop" />
      <div className="layout">
        <nav className="sidebar">
          <div className="sidebar-content">
            <h1>Gestion</h1>
            <div className="nav-section">
              <a href="/">Dashboard</a>
            </div>
          {role !== null && ["admin", "commercial", "store", "warehouse"].includes(role) && (
            <details className="nav-section" open={openCrm}>
              <summary className="nav-section-title">
                <span className="nav-title-row">
                  CRM
                  {crmBadge > 0 && <span className="nav-badge">{crmBadge}</span>}
                </span>
              </summary>
              <div className="nav-sub">
                <a href="/crm" onClick={handleNavClick("/crm")}>Inicio</a>
                <a href="/crm/board" onClick={handleNavClick("/crm/board")}>Tablero</a>
                {!["store", "warehouse"].includes(role) && (
                  <>
                    <a href="/crm/tasks" onClick={handleNavClick("/crm/tasks")}>Tareas</a>
                    <a href="/crm/calendar" onClick={handleNavClick("/crm/calendar")}>Calendario</a>
                    <a href="/crm/segments" onClick={handleNavClick("/crm/segments")}>Segmentos</a>
                  </>
                )}
                {role === "admin" && (
                  <a href="/crm/settings" onClick={handleNavClick("/crm/settings")}>
                    Ajustes CRM
                  </a>
                )}
              </div>
            </details>
          )}
          <details className="nav-section" open={openCatalogo}>
            <summary className="nav-section-title">Catalogo</summary>
            <div className="nav-sub">
              <a href="/products" onClick={handleNavClick("/products")}>Productos</a>
              <a href="/catalog" onClick={handleNavClick("/catalog")}>Catalogo</a>
              <a href="/categories" onClick={handleNavClick("/categories")}>Categorias</a>
            </div>
          </details>
          <details className="nav-section" open={openAlmacenes}>
            <summary className="nav-section-title">Almacenes</summary>
            <div className="nav-sub">
              <a href="/purchases" onClick={handleNavClick("/purchases")}>Entradas</a>
              <a href="/stock" onClick={handleNavClick("/stock")}>Stock</a>
              <a href="/locations" onClick={handleNavClick("/locations")}>Almacenes</a>
              <a href="/suppliers" onClick={handleNavClick("/suppliers")}>Proveedores</a>
            </div>
          </details>
          <details className="nav-section" open={openVentas}>
            <summary className="nav-section-title">Ventas</summary>
            <div className="nav-sub">
              <a href="/orders" onClick={handleNavClick("/orders")}>Pedidos</a>
              <a href="/orders#depositos" onClick={handleNavClick("/orders#depositos")}>Depositos</a>
              <a href="/web-orders" onClick={handleNavClick("/web-orders")}>Pedidos web</a>
              <a href="/reports" onClick={handleNavClick("/reports")}>Informes</a>
            </div>
          </details>
          <details className="nav-section" open={openClientes}>
            <summary className="nav-section-title">Clientes</summary>
            <div className="nav-sub">
              <a href="/customers" onClick={handleNavClick("/customers")}>Clientes</a>
            </div>
          </details>
            <details className="nav-section" open={openAjustes}>
              <summary className="nav-section-title">Ajustes</summary>
              <div className="nav-sub">
                <a href="/settings" onClick={handleNavClick("/settings")}>Ajustes</a>
                <a href="/settings/woo" onClick={handleNavClick("/settings/woo")}>Woo</a>
                <a href="/settings/pricing" onClick={handleNavClick("/settings/pricing")}>Precios</a>
                <a href="/settings/users" onClick={handleNavClick("/settings/users")}>Usuarios</a>
              </div>
            </details>
            <a href="/pos" className="tpv-nav mobile-only" onClick={handleNavClick("/pos")}>
              TPV
            </a>
          </div>
        </nav>
        <main>
          <div className="topbar">
            <label
              htmlFor="nav-toggle"
              className="nav-toggle-btn"
              aria-label="Abrir menu"
            >
              <span />
              <span />
              <span />
            </label>
          <div className="topbar-right">
            <img className="topbar-logo" src={LOGO_URL} alt="Rulls" />
            <button className="secondary logout-button" onClick={handleLogout}>
              Salir
            </button>
          </div>
          </div>
          {children}
          <a href="/pos" className="tpv-fab">
            TPV
          </a>
        </main>
      </div>
    </>
  );
}
