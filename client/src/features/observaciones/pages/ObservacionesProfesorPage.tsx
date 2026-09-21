import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Panel } from "@/core/components/ui/panel";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { useCursosDelCicloActivo } from "@/features/cursos/hooks/useCursosDelCicloActivo";
import { useAlumnosDelCurso } from "@/features/cursos/hooks/useAlumnosDelCurso";
import { useCategoriasPersonalizadas } from "../hooks/useCategoriasPersonalizadas";
import { useCrearCategoriaPersonalizada } from "../hooks/useCrearCategoriaPersonalizada";
import { formatFecha } from "@/core/lib/utils";
import { useCrearObservacion } from "../hooks/useCrearObservacion";
import { useObservacionesPorAlumno } from "../hooks/useObservacionesPorAlumno";
import { CATEGORIA_LABELS, type CategoriaObservacionPredefinida } from "../types";

const NUEVA_CATEGORIA = "__nueva__";
const CATEGORIA_COLOR: Record<string, string> = {
  academico: "#1E3A8A",
  comportamiento: "var(--warning)",
  felicitacion: "var(--brand)",
  administrativo: "var(--text-muted)",
};

export default function ObservacionesProfesorPage() {
  const { data: cursos } = useCursosDelCicloActivo();
  const [cursoId, setCursoId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!cursoId && cursos && cursos.length > 0) setCursoId(cursos[0].id);
  }, [cursos, cursoId]);

  const { data: alumnos } = useAlumnosDelCurso(cursoId);
  const [alumnoId, setAlumnoId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (alumnos && alumnos.length > 0 && !alumnos.find((a) => a.id === alumnoId)) {
      setAlumnoId(alumnos[0].id);
    }
    if (alumnos && alumnos.length === 0) setAlumnoId(undefined);
  }, [alumnos, alumnoId]);

  const { data: categoriasPersonalizadas } = useCategoriasPersonalizadas(cursoId);
  const { data: observaciones, isLoading, isError } = useObservacionesPorAlumno(alumnoId);
  const crearObservacion = useCrearObservacion();
  const crearCategoria = useCrearCategoriaPersonalizada();

  const nombresPorCategoria = useMemo(() => {
    const mapa = new Map<string, { label: string; color: string }>();
    for (const [id, label] of Object.entries(CATEGORIA_LABELS)) {
      mapa.set(id, { label, color: CATEGORIA_COLOR[id] });
    }
    for (const cat of categoriasPersonalizadas ?? []) {
      mapa.set(cat.id, { label: cat.nombre, color: "var(--text-muted)" });
    }
    return mapa;
  }, [categoriasPersonalizadas]);

  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState<string>("academico");
  const [catFilter, setCatFilter] = useState("all");
  const [nuevaCategoriaNombre, setNuevaCategoriaNombre] = useState("");

  const onCrearCategoria = () => {
    if (!cursoId || !nuevaCategoriaNombre.trim()) return;
    crearCategoria.mutate(
      { cursoId, nombre: nuevaCategoriaNombre.trim() },
      { onSuccess: (creada) => { setCategoria(creada.id); setNuevaCategoriaNombre(""); } },
    );
  };

  const onEnviar = () => {
    if (!alumnoId || !texto.trim() || categoria === NUEVA_CATEGORIA) return;
    crearObservacion.mutate({ alumnoId, texto: texto.trim(), categoria }, { onSuccess: () => setTexto("") });
  };

  const alumnoSeleccionado = alumnos?.find((a) => a.id === alumnoId);
  const visibles = catFilter === "all" ? observaciones : observaciones?.filter((o) => o.categoria === catFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cursoId ?? ""} onChange={(e) => setCursoId(e.target.value)} className="w-auto">
          {cursos?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[380px_1fr]">
        <Panel title="Nueva observación">
          <div className="space-y-4 p-5">
            <div className="space-y-1.5">
              <label className="label">Alumno</label>
              <Select value={alumnoId ?? ""} onChange={(e) => setAlumnoId(e.target.value)}>
                {alumnos?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} {a.apellido}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="label">Categoría</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CATEGORIA_LABELS) as [CategoriaObservacionPredefinida, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setCategoria(id)}
                    className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
                    style={{
                      background: categoria === id ? `${CATEGORIA_COLOR[id]}1f` : "var(--bg)",
                      color: categoria === id ? CATEGORIA_COLOR[id] : "var(--text-muted)",
                      border: `1px solid ${categoria === id ? CATEGORIA_COLOR[id] : "var(--border-hex)"}`,
                    }}
                  >
                    {label}
                  </button>
                ))}
                {categoriasPersonalizadas?.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoria(cat.id)}
                    className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
                    style={{
                      background: categoria === cat.id ? "var(--brand-soft)" : "var(--bg)",
                      color: categoria === cat.id ? "var(--brand)" : "var(--text-muted)",
                      border: `1px solid ${categoria === cat.id ? "var(--brand)" : "var(--border-hex)"}`,
                    }}
                  >
                    {cat.nombre}
                  </button>
                ))}
                <button
                  onClick={() => setCategoria(NUEVA_CATEGORIA)}
                  className="rounded px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground"
                  style={{ border: "1px dashed var(--border-strong)" }}
                >
                  + Nueva
                </button>
              </div>
            </div>

            {categoria === NUEVA_CATEGORIA && (
              <div className="flex items-end gap-2 rounded border p-3" style={{ borderColor: "var(--border-hex)" }}>
                <div className="flex-1 space-y-1.5">
                  <label className="label">Nombre de la nueva categoría</label>
                  <Input
                    value={nuevaCategoriaNombre}
                    onChange={(e) => setNuevaCategoriaNombre(e.target.value)}
                    placeholder="Ej: Participación en clase"
                  />
                  <p className="text-[11px] text-muted-foreground">Queda guardada solo para este curso.</p>
                </div>
                <Button onClick={onCrearCategoria} disabled={crearCategoria.isPending || !nuevaCategoriaNombre.trim()}>
                  {crearCategoria.isPending ? "Creando…" : "Crear"}
                </Button>
              </div>
            )}
            {crearCategoria.isError && (
              <p className="text-sm text-destructive">
                {crearCategoria.error instanceof ApiError ? crearCategoria.error.message : "No se pudo crear la categoría"}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="label">Observación</label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Describí brevemente la situación del alumno."
                className="w-full rounded border p-3 text-[13.5px] leading-relaxed"
                style={{ borderColor: "var(--border-hex)", resize: "none" }}
              />
              <p className="tnum text-right text-[11px] text-muted-foreground">{texto.length}/500</p>
            </div>

            {crearObservacion.isError && (
              <p className="text-sm text-destructive">
                {crearObservacion.error instanceof ApiError ? crearObservacion.error.message : "No se pudo crear la observación"}
              </p>
            )}

            <Button
              className="w-full justify-center"
              disabled={crearObservacion.isPending || !texto.trim() || !alumnoId || categoria === NUEVA_CATEGORIA}
              onClick={onEnviar}
            >
              <Send className="mr-1.5" size={14} /> Enviar observación al tutor
            </Button>
          </div>
        </Panel>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">
              Observaciones {alumnoSeleccionado && `— ${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido}`}
            </h3>
          </div>
          <div
            className="mb-4 flex w-fit flex-wrap gap-1 rounded p-1"
            style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
          >
            {[{ id: "all", label: "Todas" }, ...Object.entries(CATEGORIA_LABELS).map(([id, label]) => ({ id, label }))].map((c) => (
              <button
                key={c.id}
                onClick={() => setCatFilter(c.id)}
                className="rounded px-3 py-1.5 text-[12px] font-medium transition-all"
                style={{
                  background: catFilter === c.id ? "var(--bg)" : "transparent",
                  color: catFilter === c.id ? "var(--text)" : "var(--text-muted)",
                  boxShadow: catFilter === c.id ? "0 0 0 1px var(--border-hex)" : "none",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
            {isError && <p className="text-sm text-destructive">No se pudieron cargar las observaciones.</p>}
            {visibles?.map((o) => {
              const cat = nombresPorCategoria.get(o.categoria);
              return (
                <div key={o.id} className="card-hl p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={alumnoSeleccionado ? `${alumnoSeleccionado.nombre} ${alumnoSeleccionado.apellido}` : "?"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium"
                          style={{ color: cat?.color ?? "var(--text-muted)", background: `${cat?.color ?? "#94a3b8"}1f` }}
                        >
                          {cat?.label ?? o.categoria}
                        </span>
                        <span className="tnum shrink-0 text-[11.5px] text-muted-foreground">{formatFecha(o.fecha)}</span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{o.texto}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {visibles?.length === 0 && (
              <p className="col-span-2 py-6 text-center text-[13px] text-muted-foreground">Sin observaciones para este filtro</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
