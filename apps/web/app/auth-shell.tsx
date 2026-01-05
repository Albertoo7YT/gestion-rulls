"use client";

import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LOGO_URL =
  "https://rulls.eu/wp-content/uploads/2025/12/Rulls-Eslogan-Blanco.png";

export default function AuthShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    setAuthed(Boolean(token));
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
    setReady(true);
  }, [pathname]);

  const isLogin = useMemo(() => pathname === "/login", [pathname]);

  useEffect(() => {
    if (!ready) return;
    if (!authed && !isLogin) {
      router.replace("/login");
    }
    if (authed && isLogin) {
      router.replace("/");
    }
  }, [authed, isLogin, ready, router]);

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuthed(false);
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
          <h1>Gestion</h1>
          <div className="nav-section">
            <a href="/">Dashboard</a>
          </div>
          <details className="nav-section" open>
            <summary className="nav-section-title">Catalogo</summary>
            <div className="nav-sub">
              <a href="/products">Productos</a>
              <a href="/catalog">Catalogo</a>
              <a href="/categories">Categorias</a>
            </div>
          </details>
          <details className="nav-section">
            <summary className="nav-section-title">Almacenes</summary>
            <div className="nav-sub">
              <a href="/locations">Almacenes</a>
              <a href="/stock">Stock</a>
              <a href="/purchases">Entradas</a>
              <a href="/suppliers">Proveedores</a>
            </div>
          </details>
          <details className="nav-section">
            <summary className="nav-section-title">Ventas</summary>
            <div className="nav-sub">
              <a href="/orders">Pedidos</a>
              <a href="/web-orders">Pedidos web</a>
              <a href="/reports">Informes</a>
            </div>
          </details>
          <details className="nav-section">
            <summary className="nav-section-title">Clientes</summary>
            <div className="nav-sub">
              <a href="/customers">Clientes</a>
            </div>
          </details>
          <details className="nav-section">
            <summary className="nav-section-title">Ajustes</summary>
            <div className="nav-sub">
              <a href="/settings">Ajustes</a>
              <a href="/settings/woo">Woo</a>
              <a href="/settings/pricing">Precios</a>
              <a href="/settings/users">Usuarios</a>
            </div>
          </details>
          <a href="/pos" className="tpv-menu-link mobile-only">
            TPV
          </a>
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
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
              type="button"
            >
              <span className="moon-icon" />
            </button>
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
