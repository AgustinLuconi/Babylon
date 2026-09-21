import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS } from "@/features/auth/types";
import { useThemeStore } from "@/core/store/themeStore";
import logoTintaBlanca from "@/assets/babylon-logo-tinta-blanca.png";
import logoTintaVerde from "@/assets/babylon-logo-tinta-verde.png";
import { AREA_POR_ROL, navPorRol } from "./nav";
import { obtenerTituloPagina } from "./pageTitles";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";

function BabylonLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${dark ? "text-white" : "text-foreground"}`}>
      <img
        src={dark ? logoTintaBlanca : logoTintaVerde}
        alt="Babylon English Institute"
        className="h-8 w-8 flex-shrink-0 object-contain"
      />
      <div className="flex flex-col leading-none">
        <div className="wordmark text-[15px]">Babylon</div>
        <div
          className="wordmark-sub mt-1"
          style={{ color: dark ? "rgba(255,255,255,0.55)" : "var(--text-faint)" }}
        >
          English Institute
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { usuario, logout } = useAuth();
  const { tema, alternarTema } = useThemeStore();
  if (!usuario) return null;
  const grupos = navPorRol(usuario.rol);
  const todosLosItems = grupos.flatMap((g) => g.items);

  return (
    <div className="flex h-full w-full flex-col" style={{ background: "var(--sidebar-bg)" }}>
      <div className="px-5 pt-5 pb-4">
        <BabylonLogo dark />
      </div>
      <div style={{ height: 1, background: "var(--sidebar-border)", margin: "0 20px" }} />

      <div className="px-5 pt-4 pb-1">
        <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--sidebar-text-muted)" }}>
          <span className="h-1 w-1 rounded-full" style={{ background: "#FFFFFF", opacity: 0.7 }} />
          <span style={{ letterSpacing: "0.02em" }}>{AREA_POR_ROL[usuario.rol]}</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {grupos.map((grupo) => (
          <div key={grupo.group}>
            <div className="nav-group">{grupo.group}</div>
            {grupo.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                // Un ítem que es prefijo de otro (ej. /mis-hijos y /mis-hijos/cuotas)
                // solo se marca activo en su ruta exacta; el resto sigue activo en
                // sus subpáginas (ej. /alumnos y el legajo /alumnos/:id).
                end={todosLosItems.some((otro) => otro.to.startsWith(`${item.to}/`))}
                onClick={onNavigate}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <item.icon size={15} strokeWidth={1.6} />
                <span className="flex-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar name={usuario.nombre} tone="brand" className="!bg-white/10 !text-white !border-white/20" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium text-white">{usuario.nombre}</div>
            <div className="truncate text-[11px]" style={{ color: "var(--sidebar-text-muted)" }}>
              {ROL_LABELS[usuario.rol]}
            </div>
          </div>
          <button
            onClick={alternarTema}
            className="rounded p-1.5 transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
            title={tema === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {tema === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={logout}
            className="rounded p-1.5 transition-colors"
            style={{ color: "var(--sidebar-text-muted)" }}
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { usuario } = useAuth();
  const { pathname } = useLocation();
  const encabezado = obtenerTituloPagina(pathname);
  const puedeBuscar = usuario?.rol === "admin" || usuario?.rol === "secretario";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-subtle)" }}>
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[244px] flex-shrink-0 md:flex">
        <SidebarContent />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 flex w-[280px] flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4" style={{ background: "var(--sidebar-bg)" }}>
              <BabylonLogo dark />
              <button onClick={() => setDrawerOpen(false)} className="rounded p-1.5 text-white/70">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1">
              <SidebarContent onNavigate={() => setDrawerOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:ml-[244px]">
        <header
          className="sticky top-0 z-20 flex h-[60px] items-center gap-4 px-4 sm:px-7"
          style={{ background: "var(--bg)", borderBottom: "1px solid var(--border-hex)" }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="-ml-1.5 flex-shrink-0 rounded p-1.5 text-muted-foreground md:hidden"
          >
            <Menu size={20} />
          </button>
          <Link to="/dashboard" className="md:hidden">
            <BabylonLogo />
          </Link>

          {encabezado && (
            <div className="hidden flex-shrink-0 flex-col md:flex">
              <h1 className="text-[15.5px] font-semibold leading-none tracking-tight">{encabezado.titulo}</h1>
              {encabezado.subtitulo && (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">{encabezado.subtitulo}</p>
              )}
            </div>
          )}

          {puedeBuscar && <GlobalSearch />}

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <NotificationBell />
            {usuario && (
              <Avatar name={usuario.nombre} tone="brand" />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto" style={{ background: "var(--bg-subtle)" }}>
          <div className="px-4 py-5 md:px-7 md:py-7">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
