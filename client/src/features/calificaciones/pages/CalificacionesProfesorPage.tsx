import { useEffect, useMemo, useState } from "react";
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
import { useCursos } from "@/features/cursos/hooks/useCursos";
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
  PERIODO_LABELS,
  TIPO_EVALUACION_LABELS,
  type EscalaEvaluacion,
  type PeriodoAcademico,
  type TipoEvaluacion,
} from "../types";

function colorNota(nota: number): string {
  if (nota >= 7) return "var(--brand)";
  if (nota >= 5) return "var(--warning)";
  return "var(--danger)";
}

export default function CalificacionesProfesorPage() {
  const { data: cursos } = useCursos();
  const [cursoId, setCursoId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<"evals" | "cierre">("evals");

  useEffect(() => {
    if (!cursoId && cursos && cursos.length > 0) setCursoId(cursos[0].id);
  }, [cursos, cursoId]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cursoId ?? ""} onChange={(e) => setCursoId(e.target.value)} className="w-auto">
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
              onClick={() => setView(id)}
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

      {cursoId && (view === "evals" ? <SeccionEvaluaciones cursoId={cursoId} /> : <SeccionNotasCierre cursoId={cursoId} />)}
    </div>
  );
}

function SeccionEvaluaciones({ cursoId }: { cursoId: string }) {
  const { data: evaluaciones } = useEvaluacionesPorCurso(cursoId);
  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const crearEvaluacion = useCrearEvaluacion();
  const publicarEvaluacion = usePublicarEvaluacion();

  const [periodFilter, setPeriodFilter] = useState<"all" | PeriodoAcademico>("all");
  const [selectedEvalId, setSelectedEvalId] = useState<string | undefined>(undefined);
  const [showNewEval, setShowNewEval] = useState(false);

  const visibleEvals = useMemo(
    () => (evaluaciones ?? []).filter((e) => periodFilter === "all" || e.periodo === periodFilter),
    [evaluaciones, periodFilter],
  );

  useEffect(() => {
    if (visibleEvals.length > 0 && !visibleEvals.find((e) => e.id === selectedEvalId)) {
      setSelectedEvalId(visibleEvals[0].id);
    }
    if (visibleEvals.length === 0) setSelectedEvalId(undefined);
  }, [visibleEvals, selectedEvalId]);

  const evalObj = visibleEvals.find((e) => e.id === selectedEvalId);

  const { data: calificacionesExistentes } = useCalificacionesDeEvaluacion(selectedEvalId);
  const cargarCalificaciones = useCargarCalificaciones(selectedEvalId ?? "");

  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});

  useEffect(() => {
    const nuevoNotas: Record<string, string> = {};
    const nuevoObs: Record<string, string> = {};
    for (const c of calificacionesExistentes ?? []) {
      nuevoNotas[c.alumnoId] = c.nota;
      if (c.observacion) nuevoObs[c.alumnoId] = c.observacion;
    }
    setNotas(nuevoNotas);
    setObservaciones(nuevoObs);
  }, [calificacionesExistentes, selectedEvalId]);

  const [newForm, setNewForm] = useState({
    nombre: "",
    tipo: "examen" as TipoEvaluacion,
    periodo: "julio" as PeriodoAcademico,
    escala: "numerica" as EscalaEvaluacion,
    fecha: hoyLocalISO(),
  });

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
              className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: periodFilter === id ? "var(--brand)" : "var(--bg)",
                color: periodFilter === id ? "#fff" : "var(--text)",
                border: `1px solid ${periodFilter === id ? "var(--brand)" : "var(--border-hex)"}`,
              }}
            >
              {id === "all" ? "Todos" : PERIODO_LABELS[id]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {visibleEvals.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedEvalId(e.id)}
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
                  <span style={{ color: "var(--brand)" }}>{PERIODO_LABELS[evalObj.periodo]}</span> · {ESCALA_LABELS[evalObj.escala]}
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
            {alumnos?.map((alumno, i, arr) => {
              const nota = notas[alumno.id] ?? "";
              const tieneNota = nota.trim() !== "";
              const notaNum = Number(nota);
              const tone = evalObj.escala === "numerica" ? (tieneNota && !Number.isNaN(notaNum) ? colorNota(notaNum) : "var(--text-faint)") : "var(--text)";
              return (
                <div key={alumno.id} style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}>
                  <div className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="sm" />
                    <p className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    {evalObj.escala === "numerica" ? (
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={nota}
                          onChange={(e) => setNotas((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
                          placeholder="–"
                          className="tnum h-8 w-16 text-center font-semibold"
                          style={{ color: tone, borderColor: tieneNota ? tone : undefined }}
                        />
                        <span className="text-[11.5px] text-muted-foreground">/10</span>
                      </div>
                    ) : (
                      <Select
                        value={nota}
                        onChange={(e) => setNotas((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
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
                      onChange={(e) => setObservaciones((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
                      placeholder="Observación al padre (opcional)"
                      className="h-8 text-[12px] text-muted-foreground"
                    />
                  </div>
                </div>
              );
            })}
          </Panel>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={cargarCalificaciones.isPending} onClick={onGuardar}>
              {cargarCalificaciones.isPending ? "Guardando…" : "Guardar notas"}
            </Button>
            {evalObj.estado === "borrador" && (
              <Button
                variant="outline"
                className="flex-1"
                disabled={publicarEvaluacion.isPending}
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
            <label className="text-[12.5px] font-medium">Nombre</label>
            <Input
              value={newForm.nombre}
              onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Speaking Test 2"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium">Tipo</label>
            <Select value={newForm.tipo} onChange={(e) => setNewForm((f) => ({ ...f, tipo: e.target.value as TipoEvaluacion }))}>
              {(Object.entries(TIPO_EVALUACION_LABELS) as [TipoEvaluacion, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium">Período</label>
            <Select value={newForm.periodo} onChange={(e) => setNewForm((f) => ({ ...f, periodo: e.target.value as PeriodoAcademico }))}>
              {(Object.entries(PERIODO_LABELS) as [PeriodoAcademico, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium">Escala de calificación</label>
            <Select value={newForm.escala} onChange={(e) => setNewForm((f) => ({ ...f, escala: e.target.value as EscalaEvaluacion }))}>
              {(Object.entries(ESCALA_LABELS) as [EscalaEvaluacion, string][]).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-medium">Fecha</label>
            <Input type="date" value={newForm.fecha} onChange={(e) => setNewForm((f) => ({ ...f, fecha: e.target.value }))} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function SeccionNotasCierre({ cursoId }: { cursoId: string }) {
  const [periodo, setPeriodo] = useState<PeriodoAcademico>("julio");
  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const { data: notasExistentes } = useNotasCierrePorCurso(cursoId, periodo);
  const cargarNotasCierre = useCargarNotasCierre();
  const publicarNotasCierre = usePublicarNotasCierre();
  const [confirmar, setConfirmar] = useState(false);

  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});

  useEffect(() => {
    const nuevoNotas: Record<string, string> = {};
    const nuevoObs: Record<string, string> = {};
    for (const n of notasExistentes ?? []) {
      nuevoNotas[n.alumnoId] = n.nota;
      if (n.observacion) nuevoObs[n.alumnoId] = n.observacion;
    }
    setNotas(nuevoNotas);
    setObservaciones(nuevoObs);
  }, [notasExistentes, periodo]);

  const todasPublicadas = (alumnos?.length ?? 0) > 0 && (notasExistentes?.length ?? 0) === alumnos?.length && (notasExistentes ?? []).every((n) => n.estado === "publicada");

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
        {alumnos?.map((alumno, i, arr) => {
          const nota = notas[alumno.id] ?? "";
          const notaNum = Number(nota);
          const tone = nota.trim() && !Number.isNaN(notaNum) ? colorNota(notaNum) : "var(--text-faint)";
          return (
            <div key={alumno.id} className="px-5 py-3.5" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="sm" />
                <div className="min-w-0 flex-1" style={{ minWidth: 140 }}>
                  <p className="truncate text-[13px] font-medium">
                    {alumno.nombre} {alumno.apellido}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="eyebrow">Cierre</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={nota}
                    disabled={todasPublicadas}
                    onChange={(e) => setNotas((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
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
                  onChange={(e) => setObservaciones((actual) => ({ ...actual, [alumno.id]: e.target.value }))}
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
          <Button variant="outline" className="flex-1" disabled={cargarNotasCierre.isPending} onClick={onGuardar}>
            {cargarNotasCierre.isPending ? "Guardando…" : "Guardar borrador"}
          </Button>
          <Button
            className="flex-1"
            disabled={completas < (alumnos?.length ?? 0) || completas === 0}
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
