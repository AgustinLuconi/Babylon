import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { cn } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { COLOR_TONO, ICONO_TONO } from "@/features/notificaciones/apariencia";
import { useLeerTodas } from "@/features/notificaciones/hooks/useLeerTodas";
import { useMarcarLeida } from "@/features/notificaciones/hooks/useMarcarLeida";
import { useNotificaciones } from "@/features/notificaciones/hooks/useNotificaciones";
import { rutaDeAviso } from "@/features/notificaciones/rutas";
import type { Aviso } from "@/features/notificaciones/types";

// Avisos guardados de la cuenta en el rol actual: el número cuenta los no leídos; la lista muestra primero los no
// leídos y después los de estado que siguen abiertos aunque ya se hayan leído. Abrir la campana no marca nada: se marca
// al tocar cada aviso (o con "Marcar todas como leídas").
export function NotificationBell() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { data } = useNotificaciones();
  const marcarLeida = useMarcarLeida();
  const leerTodas = useLeerTodas();
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

  const avisos = data?.avisos ?? [];
  const noLeidas = data?.noLeidas ?? 0;

  const abrirAviso = (aviso: Aviso) => {
    if (!aviso.leida) marcarLeida.mutate(aviso.id);
    setAbierto(false);
    if (usuario) navigate(rutaDeAviso(aviso.recurso, usuario.rol));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-expanded={abierto}
        className="relative rounded p-2 text-muted-foreground transition-colors hover:bg-accent"
        title="Notificaciones"
      >
        <Bell size={17} />
        {noLeidas > 0 && (
          <span
            data-contador
            className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-center text-[10px] font-semibold leading-4 text-white"
            style={{ background: "var(--danger)" }}
          >
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] overflow-hidden rounded border bg-background shadow-lg"
          style={{ borderColor: "var(--border-hex)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5" style={{ borderColor: "var(--border-hex)" }}>
            <p className="text-[13px] font-semibold">Notificaciones</p>
            {noLeidas > 0 && (
              <button
                onClick={() => leerTodas.mutate()}
                disabled={leerTodas.isPending}
                className="text-[12px] text-muted-foreground hover:text-foreground hover:underline"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {avisos.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No hay nada pendiente.</p>
            )}
            {avisos.map((aviso) => {
              const Icono = ICONO_TONO[aviso.tono];
              return (
                <button
                  key={aviso.id}
                  data-notificacion
                  data-leida={aviso.leida}
                  onClick={() => abrirAviso(aviso)}
                  className="flex w-full items-start gap-2.5 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-accent"
                  style={{ borderColor: "var(--border-hex)", background: aviso.leida ? undefined : "var(--bg-muted)" }}
                >
                  <Icono size={14} className="mt-0.5 shrink-0" style={{ color: COLOR_TONO[aviso.tono] }} />
                  <span className={cn("flex-1 text-[12.5px] leading-relaxed", !aviso.leida && "font-medium")}>{aviso.texto}</span>
                  {!aviso.leida && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--danger-dot)" }}>
                      <span className="sr-only">Sin leer</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            to="/notificaciones"
            onClick={() => setAbierto(false)}
            className="block border-t px-4 py-2.5 text-center text-[12.5px] font-medium hover:bg-accent"
            style={{ borderColor: "var(--border-hex)" }}
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
