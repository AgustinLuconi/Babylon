import { useNavigate } from "react-router-dom";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { elegir, useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { cn, fechaLocalISO, formatFecha } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { COLOR_TONO, ICONO_TONO } from "../apariencia";
import { useHistorialNotificaciones } from "../hooks/useHistorialNotificaciones";
import { useLeerTodas } from "../hooks/useLeerTodas";
import { useMarcarLeida } from "../hooks/useMarcarLeida";
import { rutaDeAviso } from "../rutas";
import type { Aviso, FiltroHistorial } from "../types";

const FILTROS: { id: FiltroHistorial; etiqueta: string; vacio: string }[] = [
  { id: "todas", etiqueta: "Todas", vacio: "No hubo avisos en los últimos 30 días." },
  { id: "no-leidas", etiqueta: "No leídas", vacio: "No tenés avisos sin leer." },
  { id: "pendientes", etiqueta: "Pendientes", vacio: "No hay nada pendiente." },
];

const hora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

function etiquetaDelDia(fechaIso: string): string {
  const dia = fechaLocalISO(new Date(fechaIso));
  if (dia === fechaLocalISO(new Date())) return "Hoy";
  if (dia === fechaLocalISO(new Date(Date.now() - 24 * 60 * 60 * 1000))) return "Ayer";
  return formatFecha(dia);
}

function haceCuanto(fechaIso: string): string {
  const minutos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 24 * 60) return `hace ${Math.floor(minutos / 60)} h`;
  return hora.format(new Date(fechaIso));
}

// Los avisos ya vienen del más reciente al más antiguo: se agrupan por día respetando ese orden.
function porDia(avisos: Aviso[]): { dia: string; avisos: Aviso[] }[] {
  const grupos: { dia: string; avisos: Aviso[] }[] = [];
  for (const aviso of avisos) {
    const dia = etiquetaDelDia(aviso.fecha);
    const ultimo = grupos.at(-1);
    if (ultimo?.dia === dia) ultimo.avisos.push(aviso);
    else grupos.push({ dia, avisos: [aviso] });
  }
  return grupos;
}

export default function NotificacionesPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { leer, escribir } = useFiltrosDeUrl();
  const filtro = elegir(leer("filtro"), FILTROS.map((f) => f.id), "todas");
  const historial = useHistorialNotificaciones(filtro);
  const marcarLeida = useMarcarLeida();
  const leerTodas = useLeerTodas();
  const avisos = historial.data?.pages.flatMap((p) => p.avisos) ?? [];

  const abrir = (aviso: Aviso) => {
    if (!aviso.leida) marcarLeida.mutate(aviso.id);
    if (usuario) navigate(rutaDeAviso(aviso.recurso, usuario.rol));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded p-1" style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filtro === f.id}
              onClick={() => escribir({ filtro: f.id === "todas" ? null : f.id })}
              className="rounded px-3.5 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: filtro === f.id ? "var(--bg)" : "transparent",
                color: filtro === f.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: filtro === f.id ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" disabled={leerTodas.isPending} onClick={() => leerTodas.mutate()}>
          Marcar todas como leídas
        </Button>
      </div>

      {historial.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {historial.isError && (
        <p role="alert" className="text-[12.5px] text-destructive">
          No se pudieron cargar los avisos. Probá de nuevo en unos minutos.
        </p>
      )}
      {historial.isSuccess && avisos.length === 0 && (
        <p className="py-10 text-center text-[13px] text-muted-foreground">{FILTROS.find((f) => f.id === filtro)?.vacio}</p>
      )}

      {porDia(avisos).map((grupo) => (
        <Panel key={grupo.dia} title={grupo.dia}>
          <ul>
            {grupo.avisos.map((aviso) => {
              const Icono = ICONO_TONO[aviso.tono];
              return (
                <li key={aviso.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border-hex)" }}>
                  <button
                    data-aviso
                    onClick={() => abrir(aviso)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-accent"
                    style={{ background: aviso.leida ? undefined : "var(--bg-muted)" }}
                  >
                    <Icono size={15} className="mt-0.5 shrink-0" style={{ color: COLOR_TONO[aviso.tono] }} />
                    <span className={cn("min-w-0 flex-1 break-words text-[13px] leading-relaxed", !aviso.leida && "font-medium")}>
                      {aviso.texto}
                    </span>
                    {aviso.resuelta && <Badge variant="neutral">Resuelto</Badge>}
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{haceCuanto(aviso.fecha)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      ))}

      {historial.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" disabled={historial.isFetchingNextPage} onClick={() => void historial.fetchNextPage()}>
            Cargar más
          </Button>
        </div>
      )}
    </div>
  );
}
