import { useEffect, useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCheck, Info } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { fechaLocalISO, hoyLocalISO } from "@/core/lib/utils";
import { useCursosDelCicloActivo } from "@/features/cursos/hooks/useCursosDelCicloActivo";
import { useAlumnosDelCurso } from "@/features/cursos/hooks/useAlumnosDelCurso";
import { useHorarios } from "@/features/cursos/hooks/useHorarios";
import type { DiaSemana, Horario } from "@/features/cursos/types";
import { asistenciaService } from "../asistenciaService";
import { useTomarAsistencia } from "../hooks/useTomarAsistencia";
import { type Asistencia, type EstadoAsistencia } from "../types";

const DIAS_ORDEN: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

// Últimas `cantidad` clases reales de un curso, según sus horarios semanales
// (no solo "hoy") — camina hacia atrás día por día desde hoy, incluyéndolo si
// corresponde. Igual que `pastSessionsFor` del prototipo, pero con horarios reales.
function sesionesPasadas(horarios: Horario[], cantidad: number): Date[] {
  const diasValidos = new Set(horarios.map((h) => DIAS_ORDEN.indexOf(h.diaSemana) + 1));
  if (diasValidos.size === 0) return [];
  const sesiones: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; sesiones.length < cantidad && i < 400; i++) {
    if (diasValidos.has(cursor.getDay())) sesiones.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return sesiones;
}

function fmtSesionCorta(fecha: Date): string {
  const dia = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(fecha).replace(".", "");
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha.getDate()}`;
}

const ESTADOS: { id: EstadoAsistencia; label: string }[] = [
  { id: "presente", label: "Presente" },
  { id: "tarde", label: "Tarde" },
  { id: "ausente", label: "Ausente" },
];

const ESTADO_COLOR: Record<EstadoAsistencia, string> = {
  presente: "var(--brand)",
  tarde: "var(--warning)",
  ausente: "var(--danger)",
};
const ESTADO_BG: Record<EstadoAsistencia, string> = {
  presente: "var(--brand-soft)",
  tarde: "var(--warning-soft)",
  ausente: "var(--danger-soft)",
};

export default function AsistenciaProfesorPage() {
  const queryClient = useQueryClient();
  const { data: cursos } = useCursosDelCicloActivo();
  const { data: horarios } = useHorarios();
  const [cursoId, setCursoId] = useState<string | undefined>(undefined);
  const [fecha, setFecha] = useState(hoyLocalISO());

  useEffect(() => {
    if (!cursoId && cursos && cursos.length > 0) setCursoId(cursos[0].id);
  }, [cursos, cursoId]);

  const horariosDelCurso = useMemo(() => (horarios ?? []).filter((h) => h.cursoId === cursoId), [horarios, cursoId]);
  const sesiones = useMemo(() => sesionesPasadas(horariosDelCurso, 8), [horariosDelCurso]);
  const primeraSesion = sesiones[0]?.getTime();

  useEffect(() => {
    setFecha(primeraSesion ? fechaLocalISO(new Date(primeraSesion)) : hoyLocalISO());
  }, [cursoId, primeraSesion]);

  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const tomarAsistencia = useTomarAsistencia();

  const [estados, setEstados] = useState<Record<string, EstadoAsistencia>>({});
  const [minutos, setMinutos] = useState<Record<string, number>>({});
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  useEffect(() => {
    setEstados({});
    setMinutos({});
    setMotivos({});
    tomarAsistencia.reset();
  }, [cursoId, fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  const historialQueries = useQueries({
    queries: (alumnos ?? []).map((a) => ({
      queryKey: ["asistencia", "alumno", a.id],
      queryFn: () => asistenciaService.listarPorAlumno(a.id),
    })),
  });

  const ausenciasDelMes = useMemo(() => {
    const mapa = new Map<string, number>();
    const ahora = new Date();
    (alumnos ?? []).forEach((a, i) => {
      const registros = historialQueries[i]?.data ?? [];
      const count = registros.filter((r) => {
        if (r.estado !== "ausente") return false;
        const [anio, mes] = r.fecha.slice(0, 10).split("-").map(Number);
        return anio === ahora.getFullYear() && mes === ahora.getMonth() + 1;
      }).length;
      mapa.set(a.id, count);
    });
    return mapa;
  }, [alumnos, historialQueries]);

  // Historial ya cargado (reutilizado de `ausenciasDelMes`) indexado por
  // fecha — permite prellenar la clase seleccionada con lo que ya está
  // guardado en vez de mostrar el formulario siempre en blanco.
  const registrosPorAlumnoYFecha = useMemo(() => {
    const mapa = new Map<string, Map<string, Asistencia>>();
    (alumnos ?? []).forEach((a, i) => {
      const registros = (historialQueries[i]?.data ?? []).filter((r) => r.cursoId === cursoId);
      const porFecha = new Map<string, Asistencia>();
      for (const r of registros) porFecha.set(r.fecha.slice(0, 10), r);
      mapa.set(a.id, porFecha);
    });
    return mapa;
  }, [alumnos, historialQueries, cursoId]);

  const registroExistente = (alumnoId: string) => registrosPorAlumnoYFecha.get(alumnoId)?.get(fecha);
  const estadoEfectivo = (alumnoId: string): EstadoAsistencia | undefined =>
    estados[alumnoId] ?? registroExistente(alumnoId)?.estado;
  const minutosEfectivo = (alumnoId: string): number | undefined =>
    minutos[alumnoId] ?? registroExistente(alumnoId)?.minutosRetraso;
  const motivoEfectivo = (alumnoId: string): string => motivos[alumnoId] ?? registroExistente(alumnoId)?.motivo ?? "";

  const sesionCompleta = (d: Date) => {
    const iso = fechaLocalISO(d);
    if (!alumnos || alumnos.length === 0) return false;
    return alumnos.every((a) => registrosPorAlumnoYFecha.get(a.id)?.has(iso));
  };

  const total = alumnos?.length ?? 0;
  const marcados = alumnos?.filter((a) => estadoEfectivo(a.id) !== undefined).length ?? 0;
  const isToday = fecha === hoyLocalISO();

  const setEstado = (alumnoId: string, estado: EstadoAsistencia) => {
    setEstados((actual) => ({ ...actual, [alumnoId]: estado }));
  };
  const marcarTodosPresentes = () => {
    if (!alumnos) return;
    const nuevo: Record<string, EstadoAsistencia> = {};
    for (const a of alumnos) nuevo[a.id] = "presente";
    setEstados(nuevo);
  };

  const onGuardar = () => {
    if (!alumnos || !cursoId) return;
    const registros = alumnos.map((a) => {
      const estado = estadoEfectivo(a.id) ?? "presente";
      return {
        alumnoId: a.id,
        estado,
        minutosRetraso: estado === "tarde" ? minutosEfectivo(a.id) : undefined,
        motivo: estado === "ausente" ? motivoEfectivo(a.id).trim() || undefined : undefined,
      };
    });
    tomarAsistencia.mutate(
      { cursoId, fecha, registros },
      {
        onSuccess: () => {
          for (const a of alumnos) {
            queryClient.invalidateQueries({ queryKey: ["asistencia", "alumno", a.id] });
          }
        },
      },
    );
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="card-hl p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="eyebrow mb-1.5">{isToday ? "Tomar asistencia" : "Cargar asistencia atrasada"}</p>
            <Select
              value={cursoId ?? ""}
              onChange={(e) => setCursoId(e.target.value)}
              className="w-auto border-none bg-transparent p-0 text-[17px] font-semibold"
            >
              {cursos?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {(() => {
                const largo = new Intl.DateTimeFormat("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
                  .format(new Date(`${fecha}T00:00:00`))
                  .replace(",", "");
                return largo.charAt(0).toUpperCase() + largo.slice(1);
              })()}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="num-display" style={{ fontSize: 22 }}>
              <span className="tnum">{marcados}</span>
              <span className="text-[14px] text-muted-foreground">/{total}</span>
            </p>
            <p className="eyebrow mt-1">registrados</p>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--bg-muted)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: total > 0 ? `${Math.round((marcados / total) * 100)}%` : "0%",
              background: marcados === total && total > 0 ? "var(--brand)" : "var(--warning-dot)",
            }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Clase</p>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-7 w-36 text-[12px]" />
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {sesiones.map((d, i) => {
            const iso = fechaLocalISO(d);
            const active = iso === fecha;
            const hoy = iso === hoyLocalISO();
            const completa = sesionCompleta(d);
            return (
              <button
                key={i}
                onClick={() => setFecha(iso)}
                className="flex flex-shrink-0 flex-col items-center gap-1.5 rounded px-3 py-2 transition-all"
                style={{
                  minWidth: 58,
                  border: `1px solid ${active ? "var(--brand)" : "var(--border-hex)"}`,
                  background: active ? "var(--brand-soft)" : "var(--bg)",
                }}
              >
                <span className="text-[12px] font-medium" style={{ color: active ? "var(--brand)" : "var(--text)" }}>
                  {hoy ? "Hoy" : fmtSesionCorta(d)}
                </span>
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: hoy ? "var(--text-faint)" : completa ? "var(--brand-dot)" : "var(--warning-dot)" }}
                />
              </button>
            );
          })}
        </div>
        {!isToday && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Info size={11} />
            Estás viendo una clase anterior — podés cargarla o corregirla y guardar los cambios.
          </p>
        )}
      </div>

      <Button variant="outline" className="w-full justify-center" onClick={marcarTodosPresentes}>
        <CheckCheck className="mr-1.5" size={15} /> Marcar todos como presentes
      </Button>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        {alumnos?.map((alumno) => {
          const estado = estadoEfectivo(alumno.id);
          const ausencias = ausenciasDelMes.get(alumno.id) ?? 0;
          const hasAlert = ausencias >= 3;
          return (
            <div key={alumno.id} className="card-hl overflow-hidden" style={{ borderColor: hasAlert ? "var(--danger)" : undefined }}>
              <div className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="md" tone={estado === "presente" ? "brand" : "neutral"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    {hasAlert ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--danger)" }}>
                        <AlertTriangle size={10} /> <span className="tnum">{ausencias}</span> ausencias este mes
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        <span className="tnum">{ausencias}</span> ausencias en el mes
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {ESTADOS.map((st) => {
                    const active = estado === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => setEstado(alumno.id, st.id)}
                        className="flex items-center justify-center gap-1.5 rounded text-[12.5px] font-medium transition-all"
                        style={{
                          minHeight: 44,
                          background: active ? ESTADO_BG[st.id] : "var(--bg)",
                          color: active ? ESTADO_COLOR[st.id] : "var(--text-muted)",
                          border: `1px solid ${active ? ESTADO_COLOR[st.id] : "var(--border-hex)"}`,
                        }}
                      >
                        {st.label}
                      </button>
                    );
                  })}
                </div>

                {estado === "tarde" && (
                  <div className="mt-3 flex items-center gap-2">
                    <label className="flex-shrink-0 text-[12px] text-muted-foreground">Min. de retraso</label>
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={minutosEfectivo(alumno.id) ?? ""}
                      onChange={(e) => setMinutos((actual) => ({ ...actual, [alumno.id]: Number(e.target.value) }))}
                      placeholder="ej. 15"
                      className="tnum h-8 flex-1 text-[12.5px]"
                    />
                  </div>
                )}
                {estado === "ausente" && (
                  <div className="mt-3">
                    <Input
                      value={motivoEfectivo(alumno.id)}
                      onChange={(e) => setMotivos((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
                      placeholder="Motivo de ausencia (opcional)"
                      className="h-8 text-[12.5px]"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {cursoId && alumnos?.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground lg:col-span-2">Este curso todavía no tiene alumnos.</p>
        )}
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-20 md:left-[244px]"
        style={{ background: "var(--bg)", borderTop: "1px solid var(--border-hex)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-4 pt-3 pb-3">
          {tomarAsistencia.isSuccess ? (
            <div
              className="flex items-center justify-center gap-2 rounded py-3 text-[13.5px] font-medium"
              style={{ background: "var(--brand-soft)", color: "var(--brand)", border: "1px solid var(--brand)" }}
            >
              <CheckCheck size={15} /> {isToday ? "Asistencia confirmada" : "Asistencia guardada"} · {total} alumnos
            </div>
          ) : (
            <Button
              className="w-full justify-center"
              disabled={marcados === 0 || tomarAsistencia.isPending || !cursoId}
              onClick={onGuardar}
            >
              {tomarAsistencia.isPending
                ? "Guardando…"
                : marcados < total
                  ? `Guardar borrador (${marcados}/${total})`
                  : isToday
                    ? `Confirmar asistencia (${total}/${total})`
                    : `Guardar asistencia (${total}/${total})`}
            </Button>
          )}
          {tomarAsistencia.isError && (
            <p className="mt-2 text-center text-sm text-destructive">
              {tomarAsistencia.error instanceof ApiError
                ? tomarAsistencia.error.message
                : "No se pudo registrar la asistencia"}{" "}
              — no se guardó ningún registro de esta nómina para esta fecha.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
