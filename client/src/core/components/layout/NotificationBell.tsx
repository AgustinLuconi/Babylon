import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, Clock, Info } from "lucide-react";
import { useNotificaciones } from "@/features/notificaciones/hooks/useNotificaciones";
import type { TonoNotificacion } from "@/features/notificaciones/types";

const ICONO = { danger: AlertCircle, warning: Clock, info: Info } as const;
const COLOR: Record<TonoNotificacion, string> = { danger: "var(--danger)", warning: "var(--warning)", info: "var(--info)" };

// Avisos derivados del estado actual (algo pendiente o vencido), calculados en
// el server para cada rol (GET /api/notificaciones). No hay "leído": un aviso
// desaparece cuando se resuelve lo que señala.
export function NotificationBell() {
  const navigate = useNavigate();
  const { data: notificaciones } = useNotificaciones();
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [abierto]);

  const items = notificaciones ?? [];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="relative rounded p-2 text-muted-foreground transition-colors hover:bg-accent"
        title="Notificaciones"
      >
        <Bell size={17} />
        {items.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "var(--danger-dot)" }} />
        )}
      </button>

      {abierto && (
        <div
          className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[90vw] overflow-hidden rounded border bg-background shadow-lg"
          style={{ borderColor: "var(--border-hex)" }}
        >
          <div className="border-b px-4 py-2.5" style={{ borderColor: "var(--border-hex)" }}>
            <p className="text-[13px] font-semibold">Notificaciones</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No hay nada pendiente.</p>
            )}
            {items.map((n) => {
              const Icono = ICONO[n.tono];
              return (
                <button
                  key={n.id}
                  data-notificacion
                  onClick={() => {
                    navigate(n.ruta);
                    setAbierto(false);
                  }}
                  className="flex w-full items-start gap-2.5 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-accent"
                  style={{ borderColor: "var(--border-hex)" }}
                >
                  <Icono size={14} className="mt-0.5 shrink-0" style={{ color: COLOR[n.tono] }} />
                  <span className="text-[12.5px] leading-relaxed">{n.texto}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
