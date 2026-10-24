import { useEffect, useMemo, useRef, useState } from "react";
import { claseDeFila, useListaConSalidas } from "@/core/hooks/useListaConSalidas";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { Plus, Send } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Panel } from "@/core/components/ui/panel";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha, hoyLocalISO } from "@/core/lib/utils";
import { useCursosDelCicloActivo } from "@/features/cursos/hooks/useCursosDelCicloActivo";
import { useAlumnosDelCurso } from "@/features/cursos/hooks/useAlumnosDelCurso";
import { useCalificacionesDeEvaluacion } from "../hooks/useCalificacionesDeEvaluacion";
import { useCargarCalificaciones } from "../hooks/useCargarCalificaciones";
import { useCargarNotasCierre } from "../hooks/useCargarNotasCierre";
import { useCrearEvaluacion } from "../hooks/useCrearEvaluacion";
import { useEvaluacionesPorCurso } from "../hooks/useEvaluacionesPorCurso";
import { useNotasCierrePorCurso } from "../hooks/useNotasCierrePorCurso";
import { usePublicarEvaluacion } from "../hooks/usePublicarEvaluacion";
import { usePublicarNotasCierre } from "../hooks/usePublicarNotasCierre";
import {
  ESCALA_LABELS,
  MAX_OBSERVACION_NOTA, PERIODO_CIERRE_CORTO, PERIODO_CIERRE_LABELS, PERIODO_LABELS,
  TIPO_EVALUACION_LABELS,
  type EscalaEvaluacion,
  type PeriodoAcademico,
  type TipoEvaluacion,
} from "../types";
import { useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { AvisosDeNomina } from "@/features/cursos/components/AvisosDeNomina";
import { useAvisosDeNomina } from "@/features/cursos/hooks/useAvisosDeNomina";
import { useCursoPerdido } from "@/features/cursos/hooks/useCursoPerdido";

// Lo tipeado por alumno, precargado con lo guardado. Al cambiar de evaluación o período (el `contexto`) se recarga
// entero; cuando la lista de lo guardado se vuelve a pedir (una actualización en vivo, una reconexión), solo se completan
// los alumnos que el profesor no tocó: lo que tipeó nunca se pisa.
function useNotasTipeadas(guardadas: { alumnoId: string; nota: string; observacion?: string | null }[] | undefined, contexto: string | undefined) {
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const tocados = useRef(new Set<string>());
  const contextoCargado = useRef<string | undefined>(undefined);

  useEffect(() => {
    const nuevoContexto = contextoCargado.current !== contexto;
    contextoCargado.current = contexto;
    if (nuevoContexto) tocados.current = new Set();
    const guardadoNotas: Record<string, string> = {};
    const guardadoObs: Record<string, string> = {};
    for (const g of guardadas ?? []) {
      guardadoNotas[g.alumnoId] = g.nota;
      if (g.observacion) guardadoObs[g.alumnoId] = g.observacion;
    }
    const conservarLoTipeado = (actual: Record<string, string>, guardado: Record<string, string>) => {
      const resultado = { ...guardado };
      for (const id of tocados.current) {
        if (id in actual) resultado[id] = actual[id];
        else delete resultado[id];
      }
      return resultado;
    };
    setNotas((actual) => (nuevoContexto ? guardadoNotas : conservarLoTipeado(actual, guardadoNotas)));
    setObservaciones((actual) => (nuevoContexto ? guardadoObs : conservarLoTipeado(actual, guardadoObs)));
  }, [guardadas, contexto]);

  const tipearNota = (alumnoId: string, valor: string) => {
    tocados.current.add(alumnoId);
    setNotas((actual) => ({ ...actual, [alumnoId]: valor }));
  };
  const tipearObservacion = (alumnoId: string, valor: string) => {
    tocados.current.add(alumnoId);
    setObservaciones((actual) => ({ ...actual, [alumnoId]: valor }));
  };
  return { notas, observaciones, tipearNota, tipearObservacion };
}

// ¿Hay algo tipeado distinto de lo que ya está guardado, para los alumnos que siguen en la nómina? Lo tipeado para un
// alumno que se fue no cuenta: ya no se ve ni se puede guardar.
function difiereDeLoGuardado(
  notas: Record<string, string>,
  observaciones: Record<string, string>,
  guardadas: { alumnoId: string; nota: string; observacion?: string | null }[],
  nomina: { id: string }[] | undefined,
): boolean {
  const porAlumno = new Map(guardadas.map((g) => [g.alumnoId, g]));
  const ids = (nomina ?? []).map((a) => a.id);
  return ids.some(
    (id) => (notas[id] ?? "") !== (porAlumno.get(id)?.nota ?? "") || (observaciones[id] ?? "") !== (porAlumno.get(id)?.observacion ?? ""),
  );
}

function colorNota(nota: number): string {
  if (nota >= 7) return "var(--brand)";
  if (nota >= 5) return "var(--warning)";
  return "var(--danger)";
}

export default function CalificacionesProfesorPage() {
  const { data: cursos } = useCursosDelCicloActivo();
  // Curso, vista, evaluación y período en la dirección: los avisos del profesor abren exactamente lo que señalan.
  const { leer, escribir } = useFiltrosDeUrl();
  const cursoPedido = leer("curso");
  const candidato = cursos?.some((c) => c.id === cursoPedido) ? (cursoPedido as string) : cursos?.[0]?.id;
  // Si el curso abierto deja de estar a cargo del profesor, la pantalla se queda en él (con lo tipeado) y avisa.
  const cursoPerdido = useCursoPerdido(cursoPedido, candidato, cursos);
  const cursoId = cursoPerdido ?? candidato;
  const view: "evals" | "cierre" = leer("vista") === "cierre" ? "cierre" : "evals";
  const { data: nomina } = useAlumnosDelCurso(cursoId);
  const { avisos, cerrar } = useAvisosDeNomina(cursoId, nomina);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cursoId ?? ""} onChange={(e) => escribir({ curso: e.target.value, evaluacion: null, periodo: null })} className="w-auto">
          {cursos?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <div
          className="flex w-fit items-center gap-1 rounded p-1"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
        >
          {(["evals", "cierre"] as const).map((id) => (
            <button
              key={id}
              onClick={() => escribir({ vista: id === "cierre" ? "cierre" : null, evaluacion: null, periodo: null })}
              aria-pressed={view === id}
              className="rounded px-3.5 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: view === id ? "var(--bg)" : "transparent",
                color: view === id ? "var(--text)" : "var(--text-muted)",
                boxShadow: view === id ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              {id === "evals" ? "Evaluaciones" : "Notas de cierre"}
            </button>
          ))}
        </div>
      </div>

      <AvisosDeNomina avisos={avisos} onCerrar={cerrar} cursoPerdido={!!cursoPerdido} />
      {cursoId &&
        (view === "evals" ? (
          <SeccionEvaluaciones cursoId={cursoId} soloLectura={!!cursoPerdido} />
        ) : (
          <SeccionNotasCierre cursoId={cursoId} soloLectura={!!cursoPerdido} />
        ))}
    </div>
  );
}

// `soloLectura`: el curso ya no está a cargo del profesor (no se puede guardar ni publicar).
function SeccionEvaluaciones({ cursoId, soloLectura }: { cursoId: string; soloLectura: boolean }) {
  const { data: evaluaciones } = useEvaluacionesPorCurso(cursoId);
  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const filasNomina = useListaConSalidas(alumnos ?? [], (a) => a.id, ["alumnos"]);
  const crearEvaluacion = useCrearEvaluacion();
  const publicarEvaluacion = usePublicarEvaluacion();

  const { leer, escribir } = useFiltrosDeUrl();
  const periodoPedido = leer("periodo");
  const periodFilter: "all" | PeriodoAcademico = periodoPedido === "julio" || periodoPedido === "noviembre" ? periodoPedido : "all";
  const setPeriodFilter = (id: "all" | PeriodoAcademico) => escribir({ periodo: id === "all" ? null : id, evaluacion: null });
  const [showNewEval, setShowNewEval] = useState(false);

  const visibleEvals = useMemo(
    () => (evaluaciones ?? []).filter((e) => periodFilter === "all" || e.periodo === periodFilter),
    [evaluaciones, periodFilter],
  );

  const evaluacionPedida = leer("evaluacion");
  const selectedEvalId = visibleEvals.some((e) => e.id === evaluacionPedida) ? (evaluacionPedida as string) : visibleEvals[0]?.id;
  const setSelectedEvalId = (id: string) => escribir({ evaluacion: id });

  const evalObj = visibleEvals.find((e) => e.id === selectedEvalId);

  const { data: calificacionesExistentes } = useCalificacionesDeEvaluacion(selectedEvalId);
  const cargarCalificaciones = useCargarCalificaciones(selectedEvalId ?? "");

  const { notas, observaciones, tipearNota, tipearObservacion } = useNotasTipeadas(calificacionesExistentes, selectedEvalId);

  const [newForm, setNewForm] = useState({
    nombre: "",
    tipo: "examen" as TipoEvaluacion,
    periodo: "julio" as PeriodoAcademico,
    escala: "numerica" as EscalaEvaluacion,
    fecha: hoyLocalISO(),
  });
  const nuevaEvaluacionSinGuardar = showNewEval && newForm.nombre.trim() !== "";
  useSinGuardar(difiereDeLoGuardado(notas, observaciones, calificacionesExistentes ?? [], alumnos) || nuevaEvaluacionSinGuardar);

  const notasNumericas = evalObj?.escala === "numerica" ? Object.values(notas).map(Number).filter((n) => !Number.isNaN(n)) : [];
  const promedio = notasNumericas.length ? (notasNumericas.reduce((a, n) => a + n, 0) / notasNumericas.length).toFixed(1) : "—";
  const aprobados = notasNumericas.filter((n) => n >= 7).length;
  const cargadas = Object.values(notas).filter((v) => v.trim()).length;

  const onGuardar = () => {
    if (!alumnos || !evalObj) return;
    const notasCompletas = alumnos
      .filter((a) => notas[a.id]?.trim())
      .map((a) => ({ alumnoId: a.id, nota: notas[a.id], observacion: observaciones[a.id]?.trim() || undefined }));
    if (notasCompletas.length === 0) return;
    cargarCalificaciones.mutate({ notas: notasCompletas });
  };

  const onCrearEvaluacion = async () => {
    if (!newForm.nombre.trim()) return;
    const creada = await crearEvaluacion.mutateAsync({ ...newForm, cursoId });
    setSelectedEvalId(creada.id);
    setShowNewEval(false);
    setNewForm({ nombre: "", tipo: "examen", periodo: "julio", escala: "numerica", fecha: hoyLocalISO() });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1">Período:</span>
          {(["all", "julio", "noviembre"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setPeriodFilter(id)}
              aria-pressed={periodFilter === id}
              className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: periodFilter === id ? "var(--brand)" : "var(--bg)",
                color: periodFilter === id ? "#fff" : "var(--text)",
                border: `1px solid ${periodFilter === id ? "var(--brand)" : "var(--border-hex)"}`,
              }}
            >
              {id === "all" ? "Todos" : PERIODO_CIERRE_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleEvals.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEvalId(e.id)}
              aria-pressed={selectedEvalId === e.id}
              className="flex items-center gap-2 rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: selectedEvalId === e.id ? "var(--brand)" : "var(--bg)",
                color: selectedEvalId === e.id ? "#fff" : "var(--text)",
                border: `1px solid ${selectedEvalId === e.id ? "var(--brand)" : "var(--border-hex)"}`,
              }}
            >
              {e.nombre}
              {e.estado === "borrador" && (
                <span
                  className="rounded px-1 py-0.5 text-[10px] font-medium"
                  style={{
                    background: selectedEvalId === e.id ? "rgba(255,255,255,0.2)" : "var(--warning-soft)",
                    color: selectedEvalId === e.id ? "#fff" : "var(--warning)",
                  }}
                >
                  Borrador
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setShowNewEval(true)}
            disabled={soloLectura}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground"
            style={{ border: "1px dashed var(--border-strong)" }}
          >
            <Plus size={13} /> Nueva
          </button>
        </div>
      </div>

      {evalObj && (
        <>
          <div className="card-hl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-[15.5px] font-semibold tracking-tight">{evalObj.nombre}</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {TIPO_EVALUACION_LABELS[evalObj.tipo]} · <span className="tnum">{formatFecha(evalObj.fecha)}</span> ·{" "}
                  <span style={{ color: "var(--brand)" }}>{PERIODO_CIERRE_CORTO[evalObj.periodo]}</span> · {ESCALA_LABELS[evalObj.escala]}
                </p>
              </div>
              {evalObj.estado === "borrador" && <Badge variant="warning">Borrador</Badge>}
            </div>
            {evalObj.escala === "numerica" && (
              <div className="mt-5 grid grid-cols-3 border-t pt-5" style={{ borderColor: "var(--border-hex)" }}>
                <div>
                  <p className="eyebrow">Promedio</p>
                  <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: promedio !== "—" ? colorNota(Number(promedio)) : undefined }}>
                    {promedio}
                  </p>
                </div>
                <div className="border-l pl-4" style={{ borderColor: "var(--border-hex)" }}>
                  <p className="eyebrow">Cargadas</p>
                  <p className="num-display tnum mt-1.5" style={{ fontSize: 24 }}>
                    {cargadas}
                    <span className="text-[14px] text-muted-foreground">/{alumnos?.length ?? 0}</span>
                  </p>
                </div>
                <div className="border-l pl-4" style={{ borderColor: "var(--border-hex)" }}>
                  <p className="eyebrow">≥7</p>
                  <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: "var(--brand)" }}>
                    {aprobados}
                  </p>
                </div>
              </div>
            )}
          </div>

          <Panel title="Notas por alumno">
            {filasNomina.map(({ item: alumno, estado: estadoFila }, i, arr) => {
              const nota = notas[alumno.id] ?? "";
              const tieneNota = nota.trim() !== "";
              const notaNum = Number(nota);
              const tone = evalObj.escala === "numerica" ? (tieneNota && !Number.isNaN(notaNum) ? colorNota(notaNum) : "var(--text-faint)") : "var(--text)";
              return (
                <div key={alumno.id} data-alumno={alumno.id} className={claseDeFila(estadoFila)} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    {evalObj.escala === "numerica" ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={nota}
                          onChange={(e) => tipearNota(alumno.id, e.target.value)}
                          placeholder="–"
                          className="tnum h-8 w-16 text-center font-semibold"
                          style={{ color: tone, borderColor: tieneNota ? tone : undefined }}
                        />
                        <span className="text-[11.5px] text-muted-foreground">/10</span>
                      </div>
                    ) : (
                      <Select
                        value={nota}
                        onChange={(e) => tipearNota(alumno.id, e.target.value)}
                        className="h-8 w-32 text-[12.5px]"
                      >
                        <option value="">—</option>
                        <option value="MB">MB · Muy Bueno</option>
                        <option value="B">B · Bueno</option>
                        <option value="R">R · Regular</option>
                        <option value="M">M · Malo</option>
                      </Select>
                    )}
                  </div>
                  <div className="px-5 pb-3">
                    <Input
                      value={observaciones[alumno.id] ?? ""}
                      onChange={(e) => tipearObservacion(alumno.id, e.target.value)}
                      placeholder={`Observación al padre (opcional, máx ${MAX_OBSERVACION_NOTA} car.)`}
                      maxLength={MAX_OBSERVACION_NOTA}
                      className="text-[12px] text-muted-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </Panel>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={cargarCalificaciones.isPending || soloLectura} onClick={onGuardar}>
              {cargarCalificaciones.isPending ? "Guardando…" : "Guardar notas"}
            </Button>
            {evalObj.estado === "borrador" && (
              <Button
                variant="outline"
                className="flex-1"
                disabled={publicarEvaluacion.isPending || soloLectura}
                onClick={() => publicarEvaluacion.mutate(evalObj.id)}
              >
                <Send className="mr-1.5" size={14} /> Publicar notas
              </Button>
            )}
          </div>
          {cargarCalificaciones.isError && (
            <p className="text-sm text-destructive">
              {cargarCalificaciones.error instanceof ApiError ? cargarCalificaciones.error.message : "No se pudieron guardar las notas"}
            </p>
          )}
          {cargarCalificaciones.isSuccess && <p className="text-sm" style={{ color: "var(--brand)" }}>Notas guardadas correctamente.</p>}
        </>
      )}

      {!evalObj && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {evaluaciones?.length === 0 ? "Todavía no hay evaluaciones para este curso." : "Elegí una evaluación."}
        </p>
      )}

      {showNewEval && (
        <Modal
          sinGuardar={nuevaEvaluacionSinGuardar}
          title="Nueva evaluación"
          onClose={() => setShowNewEval(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setShowNewEval(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={!newForm.nombre.trim() || crearEvaluacion.isPending} onClick={onCrearEvaluacion}>
                {crearEvaluacion.isPending ? "Creando…" : "Crear"}
              </Button>
            </>
          }
        >
          <div className="space-y-1.5">
            <label className="label">Nombre</label>
            <Input
              value={newForm.nombre}
              onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Speaking Test 2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Tipo</label>
            <Select value={newForm.tipo} onChange={(e) => setNewForm((f) => ({ ...f, tipo: e.target.value as TipoEvaluacion }))}>
              {(Object.entries(TIPO_EVALUACION_LABELS) as [TipoEvaluacion, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="label">Período</label>
            <Select value={newForm.periodo} onChange={(e) => setNewForm((f) => ({ ...f, periodo: e.target.value as PeriodoAcademico }))}>
              {(Object.entries(PERIODO_LABELS) as [PeriodoAcademico, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="label">Escala de calificación</label>
            <Select value={newForm.escala} onChange={(e) => setNewForm((f) => ({ ...f, escala: e.target.value as EscalaEvaluacion }))}>
              {(Object.entries(ESCALA_LABELS) as [EscalaEvaluacion, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="label">Fecha</label>
            <Input type="date" value={newForm.fecha} onChange={(e) => setNewForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function SeccionNotasCierre({ cursoId, soloLectura }: { cursoId: string; soloLectura: boolean }) {
  const { leer, escribir } = useFiltrosDeUrl();
  const periodo: PeriodoAcademico = leer("periodo") === "noviembre" ? "noviembre" : "julio";
  const setPeriodo = (p: PeriodoAcademico) => escribir({ periodo: p === "julio" ? null : p });
  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const filasNomina = useListaConSalidas(alumnos ?? [], (a) => a.id, ["alumnos"]);
  const { data: notasExistentes } = useNotasCierrePorCurso(cursoId, periodo);
  const cargarNotasCierre = useCargarNotasCierre();
  const publicarNotasCierre = usePublicarNotasCierre();
  const [confirmar, setConfirmar] = useState(false);

  const { notas, observaciones, tipearNota, tipearObservacion } = useNotasTipeadas(notasExistentes, `${cursoId}|${periodo}`);
  useSinGuardar(difiereDeLoGuardado(notas, observaciones, notasExistentes ?? [], alumnos));


  // Sobre la nómina actual: una baja no vuelve borrador las notas ya publicadas de los demás.
  const todasPublicadas =
    (alumnos?.length ?? 0) > 0 && (alumnos ?? []).every((a) => (notasExistentes ?? []).some((n) => n.alumnoId === a.id && n.estado === "publicada"));

  const completas = alumnos?.filter((a) => notas[a.id]?.trim()).length ?? 0;

  const registrosActuales = () =>
    (alumnos ?? [])
      .filter((a) => notas[a.id]?.trim())
      .map((a) => ({ alumnoId: a.id, cursoId, periodo, nota: notas[a.id], observacion: observaciones[a.id]?.trim() || undefined }));

  const onGuardar = () => {
    const registros = registrosActuales();
    if (registros.length === 0) return;
    cargarNotasCierre.mutate(registros);
  };

  // Publicar siempre guarda primero lo que esté tipeado en pantalla y recién
  // publica con los ids que devuelve ese guardado — evita publicar una foto
  // vieja de notasExistentes si el profesor tipeó algo y no clickeó "Guardar".
  const onPublicar = async () => {
    const registros = registrosActuales();
    if (registros.length === 0) return;
    const guardadas = await cargarNotasCierre.mutateAsync(registros);
    setConfirmar(false);
    publicarNotasCierre.mutate(guardadas.map((n) => n.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">Período:</span>
        {(["julio", "noviembre"] as PeriodoAcademico[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            aria-pressed={periodo === p}
            className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
            style={{
              background: periodo === p ? "var(--brand)" : "var(--bg)",
              color: periodo === p ? "#fff" : "var(--text)",
              border: `1px solid ${periodo === p ? "var(--brand)" : "var(--border-hex)"}`,
            }}
          >
            {PERIODO_LABELS[p]}
          </button>
        ))}
      </div>

      <Panel title={`Notas de cierre — ${PERIODO_LABELS[periodo]}`} action={<Badge variant={todasPublicadas ? "success" : "warning"}>{todasPublicadas ? "Publicadas" : "Borrador"}</Badge>}>
        {filasNomina.map(({ item: alumno, estado: estadoFila }, i, arr) => {
          const nota = notas[alumno.id] ?? "";
          const notaNum = Number(nota);
          const tone = nota.trim() && !Number.isNaN(notaNum) ? colorNota(notaNum) : "var(--text-faint)";
          return (
            <div key={alumno.id} data-alumno={alumno.id} className={`px-5 py-3.5 ${claseDeFila(estadoFila)}`} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="sm" />
                <div className="min-w-0 flex-1" style={{ minWidth: 140 }}>
                  <p className="truncate text-[13px] font-medium">
                    {alumno.nombre} {alumno.apellido}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="eyebrow">Cierre</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={nota}
                    disabled={todasPublicadas}
                    onChange={(e) => tipearNota(alumno.id, e.target.value)}
                    placeholder="–"
                    className="tnum h-8 w-16 text-center font-semibold"
                    style={{ color: tone, borderColor: nota.trim() ? tone : undefined, opacity: todasPublicadas ? 0.7 : 1 }}
                  />
                </div>
              </div>
              <div className="mt-2" style={{ marginLeft: 40 }}>
                <Input
                  value={observaciones[alumno.id] ?? ""}
                  disabled={todasPublicadas}
                  onChange={(e) => tipearObservacion(alumno.id, e.target.value)}
                  placeholder="Observación de cierre (opcional)"
                  className="h-8 text-[12.5px]"
                  style={{ opacity: todasPublicadas ? 0.7 : 1 }}
                />
              </div>
            </div>
          );
        })}
        {alumnos?.length === 0 && <p className="px-5 py-6 text-center text-sm text-muted-foreground">Este curso no tiene alumnos.</p>}
      </Panel>

      {!todasPublicadas ? (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={cargarNotasCierre.isPending || soloLectura} onClick={onGuardar}>
            {cargarNotasCierre.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button
            className="flex-1"
            disabled={completas < (alumnos?.length ?? 0) || completas === 0 || soloLectura}
            onClick={() => setConfirmar(true)}
          >
            <Send className="mr-1.5" size={14} /> Publicar notas de cierre ({completas}/{alumnos?.length ?? 0})
          </Button>
        </div>
      ) : (
        <p className="text-center text-[12px] text-muted-foreground">Las notas de cierre publicadas ya son visibles para las familias.</p>
      )}

      {cargarNotasCierre.isError && (
        <p className="text-sm text-destructive">
          {cargarNotasCierre.error instanceof ApiError ? cargarNotasCierre.error.message : "No se pudieron guardar las notas de cierre"}
        </p>
      )}
      {cargarNotasCierre.isSuccess && <p className="text-sm" style={{ color: "var(--brand)" }}>Borrador guardado correctamente.</p>}

      {confirmar && (
        <Modal
          title="Publicar notas de cierre"
          onClose={() => setConfirmar(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmar(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={publicarNotasCierre.isPending || cargarNotasCierre.isPending} onClick={onPublicar}>
                {publicarNotasCierre.isPending || cargarNotasCierre.isPending ? "Publicando…" : "Publicar"}
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Vas a publicar las notas de cierre del <strong>{PERIODO_LABELS[periodo]}</strong> para {alumnos?.length ?? 0} alumnos. Una
            vez publicadas, los padres podrán verlas de inmediato.
          </p>
        </Modal>
      )}
    </div>
  );
}
