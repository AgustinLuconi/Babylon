import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleUser, LogOut, Moon, Sun } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { useThemeStore } from "@/core/store/themeStore";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS } from "@/features/auth/types";

const ITEM = "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] hover:bg-accent";

// Menú de la persona, en la esquina superior derecha: sus datos, ir a Mi cuenta, cambiar entre modo claro y oscuro y cerrar
// sesión. Se cierra al elegir una acción, al tocar afuera o con Escape.
export function MenuDeUsuario() {
  const { usuario, logout } = useAuth();
  const { tema, alternarTema } = useThemeStore();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const onTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onTecla);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onTecla);
    };
  }, [abierto]);

  if (!usuario) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((a) => !a)}
        aria-label="Menú de usuario"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title={usuario.nombre}
        className="block rounded transition-opacity hover:opacity-80"
      >
        <Avatar name={usuario.nombre} tone="brand" />
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-64 max-w-[90vw] overflow-hidden rounded border bg-background shadow-lg"
          style={{ borderColor: "var(--border-hex)" }}
        >
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-hex)" }}>
            <p className="truncate text-[13px] font-semibold">{usuario.nombre}</p>
            <p className="truncate text-[12px] text-muted-foreground">{usuario.email}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{ROL_LABELS[usuario.rol]}</p>
          </div>
          <div className="py-1">
            <Link to="/mi-cuenta" role="menuitem" onClick={() => setAbierto(false)} className={ITEM}>
              <CircleUser size={15} strokeWidth={1.6} /> Mi cuenta
            </Link>
            <button
              role="menuitem"
              onClick={() => {
                alternarTema();
                setAbierto(false);
              }}
              className={ITEM}
            >
              {tema === "dark" ? <Sun size={15} strokeWidth={1.6} /> : <Moon size={15} strokeWidth={1.6} />}
              {tema === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
          </div>
          <div className="border-t py-1" style={{ borderColor: "var(--border-hex)" }}>
            <button role="menuitem" onClick={logout} className={ITEM}>
              <LogOut size={15} strokeWidth={1.6} /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
