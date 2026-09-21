import { useNavigate } from "react-router-dom";
import { Receipt, UserPlus, Receipt as ReceiptIcon, MessageSquare, Circle } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Avatar } from "@/core/components/ui/avatar";
import { Panel } from "@/core/components/ui/panel";
import { KpiCard } from "@/core/components/ui/kpi-card";
import { MiniBars } from "@/core/components/ui/mini-bars";
import { formatearVariacionPp, formatFechaLarga, formatMonto } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useResumenDashboard } from "@/features/reportes/hooks/useResumenDashboard";
import { NIVEL_GRUPO, type NivelCurso } from "@/features/cursos/types";
import { TIPO_EVALUACION_LABELS, type TipoEvaluacion } from "@/features/calificaciones/types";
import type { TipoActividad } from "@/features/reportes/types";

const NIVEL_COLOR: Record<"kids" | "teens" | "adults" | "cambridge", string> = {
  kids: "#0EA5E9",
  teens: "#7C3AED",
  adults: "#C2410C",
  cambridge: "#B45309",
};

const GRUPO_LABELS: Record<"kids" | "teens" | "adults" | "cambridge", string> = {
  kids: "Kids",
  teens: "Teens",
  adults: "Adults",
  cambridge: "Camb.",
};

const GRUPO_LABELS_LARGO: Record<"kids" | "teens" | "adults" | "cambridge", string> = {
  kids: "Kids",
  teens: "Teens",
  adults: "Adults",
  cambridge: "Cambridge",
};

const MES_ABREVIADO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const ACTIVIDAD_ICON: Record<TipoActividad, typeof UserPlus> = {
  enrollment: UserPlus,
  payment: ReceiptIcon,
  observation: MessageSquare,
};

function tiempoRelativo(fechaIso: string): string {
  const diffMs = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `hace ${dias} d`;
}

export default function AdminDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { data: resumen, isLoading, isError } = useResumenDashboard();

  const hoy = formatFechaLarga();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const tendencias = resumen?.tendencias ?? null;
  const propsVariacion = (pp: number | null | undefined, mesAnterior: string | undefined) => {
    if (pp === null || pp === undefined) return {};
    const { delta, tono } = formatearVariacionPp(pp);
    return { delta, deltaTone: tono, sub: `vs ${mesAnterior}` };
  };

  const totalDebt = resumen?.cuotasVencidas.reduce((a, f) => a + f.monto, 0) ?? 0;

  const composicion = (["kids", "teens", "adults", "cambridge"] as const).map((grupo) => {
    const total = Object.entries(resumen?.composicionPorNivel ?? {}).reduce(
      (acc, [nivel, cantidad]) => (NIVEL_GRUPO[nivel as NivelCurso] === grupo ? acc + cantidad : acc),
      0,
    );
    return { grupo, total };
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2 capitalize">{hoy}</p>
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
            {saludo}, {usuario?.nombre.split(" ")[0]}
          </h2>
          {resumen && (
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {resumen.cuotasVencidas.length > 0
                ? `${resumen.cuotasVencidas.length} cuota${resumen.cuotasVencidas.length !== 1 ? "s" : ""} vencida${resumen.cuotasVencidas.length !== 1 ? "s" : ""} suman ${formatMonto(totalDebt)}. `
                : "No hay cuotas vencidas. "}
              La asistencia promedio es del {resumen.asistenciaPromedioPct}%.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/alumnos/inscribir")}>
            <UserPlus className="mr-1.5" size={14} /> Inscribir alumno
          </Button>
          <Button onClick={() => navigate("/cuotas")}>
            <Receipt className="mr-1.5" size={14} /> Registrar pago
          </Button>
        </div>
      </div>

      {isError && <p className="text-sm text-destructive">No se pudieron cargar los datos del dashboard.</p>}

      {(isLoading || resumen) && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Alumnos activos"
              value={isLoading ? "…" : String(resumen!.alumnosActivos)}
              delta={tendencias ? `+${tendencias.alumnosNuevosMes}` : undefined}
              deltaTone={tendencias && tendencias.alumnosNuevosMes === 0 ? "neutral" : "positive"}
              sub={tendencias ? "este mes" : undefined}
              onClick={() => navigate("/alumnos")}
            />
            <KpiCard
              label="Cuotas al día"
              value={isLoading ? "…" : `${resumen!.cuotasAlDiaPct}%`}
              {...propsVariacion(tendencias?.cuotasAlDiaVariacionPp, tendencias?.mesAnteriorNombre)}
              onClick={() => navigate("/cuotas")}
            />
            <KpiCard
              label="Asistencia promedio"
              value={isLoading ? "…" : `${resumen!.asistenciaPromedioPct}%`}
              {...propsVariacion(tendencias?.asistenciaVariacionPp, tendencias?.mesAnteriorNombre)}
            />
            <KpiCard
              label="Cursos activos"
              value={isLoading ? "…" : String(resumen!.cursosActivos)}
              sub={!isLoading ? `${resumen!.docentesCount} docentes · ${resumen!.nivelesCount} niveles` : undefined}
              onClick={() => navigate("/cursos-todos")}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel
                title="Cuotas vencidas"
                action={
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-medium tnum" style={{ color: "var(--danger)" }}>
                      {formatMonto(totalDebt)}
                    </span>
                    <button
                      onClick={() => navigate("/cuotas")}
                      className="text-[12px] font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      Ver todas →
                    </button>
                  </div>
                }
              >
                {resumen && resumen.cuotasVencidas.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">No hay cuotas vencidas.</p>
                )}
                {resumen && resumen.cuotasVencidas.length > 0 && (
                  <table className="tbl hidden md:table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Curso</th>
                        <th>Mes</th>
                        <th style={{ textAlign: "right" }}>Atraso</th>
                        <th style={{ textAlign: "right" }}>Monto</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.cuotasVencidas.map((f, i) => (
                        <tr key={i}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={f.alumnoNombre} size="xs" />
                              <span className="font-medium">{f.alumnoNombre}</span>
                            </div>
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {f.cursoNivel && (
                              <span className={`level-pill ${NIVEL_GRUPO[f.cursoNivel as NivelCurso]}`}>
                                {f.cursoNombre}
                              </span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {f.mes}/{f.anio}
                          </td>
                          <td
                            className="tnum"
                            style={{ textAlign: "right", color: f.diasVencido >= 30 ? "var(--danger)" : "var(--warning)" }}
                          >
                            {f.diasVencido} d.
                          </td>
                          <td className="tnum font-medium" style={{ textAlign: "right" }}>
                            {formatMonto(f.monto)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Button variant="outline" size="sm" onClick={() => navigate("/cuotas")}>
                              Cobrar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </div>

            <div className="lg:col-span-2">
              <Panel title="Próximas evaluaciones">
                {resumen && resumen.proximasEvaluaciones.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">No hay evaluaciones próximas.</p>
                )}
                {resumen?.proximasEvaluaciones.map((e, i) => {
                  // e.fecha es una fecha calendario (medianoche UTC, sin hora real) —
                  // se lee del string ISO directamente, sin pasar por Date, para no
                  // correrse un día por el huso horario local (mismo criterio que
                  // el resto del client, ver AlumnoDetailPage `.slice(0, 10)`).
                  const [, mesNum, diaNum] = e.fecha.slice(0, 10).split("-");
                  return (
                    <div
                      key={e.evaluacionId}
                      className="flex items-start gap-4 px-5 py-3"
                      style={{ borderBottom: i < resumen.proximasEvaluaciones.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                    >
                      <div className="shrink-0 text-center" style={{ width: 38 }}>
                        <p className="text-[13px] font-semibold leading-none tnum">{Number(diaNum)}</p>
                        <p className="mt-1.5 text-[10px] uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                          {MES_ABREVIADO[Number(mesNum) - 1]}
                        </p>
                      </div>
                      <div className="min-w-0 flex-1 border-l pl-4" style={{ borderColor: "var(--border-hex)" }}>
                        <span className={`level-pill ${NIVEL_GRUPO[e.cursoNivel as NivelCurso]}`}>{e.cursoNombre}</span>
                        <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                          {TIPO_EVALUACION_LABELS[e.tipo as TipoEvaluacion]}
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {e.profesorNombre}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </Panel>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Panel title="Composición por nivel">
                <div className="px-5 py-5">
                  <MiniBars
                    data={composicion.map((c) => c.total)}
                    labels={composicion.map((c) => GRUPO_LABELS[c.grupo])}
                    colors={composicion.map((c) => NIVEL_COLOR[c.grupo])}
                    height={100}
                  />
                  <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
                    {composicion.map((c) => (
                      <div key={c.grupo} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: NIVEL_COLOR[c.grupo] }} />
                          {GRUPO_LABELS_LARGO[c.grupo]}
                        </span>
                        <span className="tnum font-medium">{c.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </div>

            <div className="lg:col-span-3">
              <Panel title="Actividad reciente">
                {resumen && resumen.actividadReciente.length === 0 && (
                  <p className="px-5 py-6 text-center text-sm text-muted-foreground">Todavía no hay actividad.</p>
                )}
                {resumen?.actividadReciente.map((a, i) => {
                  const Icono = ACTIVIDAD_ICON[a.tipo] ?? Circle;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-3"
                      style={{ borderBottom: i < resumen.actividadReciente.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                    >
                      <div
                        className="flex shrink-0 items-center justify-center"
                        style={{ width: 26, height: 26, borderRadius: 3, background: "var(--bg-muted)", color: "var(--text-muted)" }}
                      >
                        <Icono size={13} />
                      </div>
                      <div className="min-w-0 flex-1 text-[12.5px]">
                        <span className="font-medium">{a.actor}</span> <span className="text-muted-foreground">{a.verbo}</span>{" "}
                        <span className="font-medium">{a.objetivo}</span>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[11px]" style={{ color: "var(--text-faint)" }}>
                        {tiempoRelativo(a.fecha)}
                      </span>
                    </div>
                  );
                })}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
