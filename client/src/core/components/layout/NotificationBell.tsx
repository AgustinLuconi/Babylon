import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, DollarSign, FileWarning } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useResumenDashboard } from "@/features/reportes/hooks/useResumenDashboard";
import { formatMonto } from "@/core/lib/utils";

interface ItemNotificacion {
  id: string;
  icono: typeof DollarSign;
  tono: "danger" | "warning" | "info";
  texto: string;
  onClick: () => void;
}

// Solo admin/secretario tienen un agregado real (`/api/reportes/dashboard`)
// del que derivar notificaciones honestas — no se fabrica contenido para
// los demás roles, se muestra un estado vacío real hasta que exista una
// fuente de datos equivalente para profesor/padre.
export function NotificationBell() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const puedeVerResumen = usuario?.rol === "admin" || usuario?.rol === "secretario";
  const { data: resumen } = useResumenDashboard({ enabled: puedeVerResumen });
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

  const items = useMemo<ItemNotificacion[]>(() => {
    if (!resumen) return [];
    const lista: ItemNotificacion[] = [];
    for (const f of resumen.cuotasVencidas.slice(0, 5)) {
      lista.push({
        id: `cuota-${f.alumnoId}-${f.mes}-${f.anio}`,
        icono: DollarSign,
        tono: "danger",
        texto: `Cuota vencida: ${f.alumnoNombre} — ${formatMonto(f.monto)}`,
        onClick: () => navigate("/cuotas"),
      });
    }
    if (resumen.documentacionPendienteCount > 0) {
      lista.push({
        id: "documentacion-pendiente",
        icono: FileWarning,
        tono: "warning",
        texto: `${resumen.documentacionPendienteCount} alumno${resumen.documentacionPendienteCount !== 1 ? "s" : ""} con autorización de imagen pendiente`,
        onClick: () => navigate("/alumnos"),
      });
    }
    for (const ev of resumen.proximasEvaluaciones.slice(0, 3)) {
      lista.push({
        id: `evaluacion-${ev.evaluacionId}`,
        icono: CalendarClock,
        tono: "info",
        texto: `Evaluación próxima: ${ev.nombre} — ${ev.cursoNombre}`,
        onClick: () => navigate("/reportes"),
      });
    }
    return lista;
  }, [resumen, navigate]);

  const colorTono = { danger: "var(--danger)", warning: "var(--warning)", info: "var(--info)" } as const;

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
            {!puedeVerResumen && (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No hay notificaciones nuevas.</p>
            )}
            {puedeVerResumen && items.length === 0 && (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No hay notificaciones nuevas.</p>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  item.onClick();
                  setAbierto(false);
                }}
                className="flex w-full items-start gap-2.5 border-b px-4 py-2.5 text-left last:border-b-0 hover:bg-accent"
                style={{ borderColor: "var(--border-hex)" }}
              >
                <item.icono size={14} className="mt-0.5 shrink-0" style={{ color: colorTono[item.tono] }} />
                <span className="text-[12.5px] leading-relaxed">{item.texto}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
