import { useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueries } from "@tanstack/react-query";
import { z } from "zod";
import { ChevronLeft, Pencil, Plus, Search, ToggleLeft, ToggleRight, Trash2, Users } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Select } from "@/core/components/ui/select";
import { Badge } from "@/core/components/ui/badge";
import { Avatar } from "@/core/components/ui/avatar";
import { Modal } from "@/core/components/ui/modal";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { normalizarTexto } from "@/core/lib/utils";
import { useAlumnos } from "@/features/alumnos/hooks/useAlumnos";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useCuotas } from "@/features/cuotas/hooks/useCuotas";
import type { EstadoCuota } from "@/features/cuotas/types";
import { asistenciaService } from "@/features/asistencia/asistenciaService";
import { useProfesores } from "@/features/profesores/hooks/useProfesores";
import { useCrearCurso } from "../hooks/useCrearCurso";
import { useActualizarCurso } from "../hooks/useActualizarCurso";
import { useCursos } from "../hooks/useCursos";
import { useHorarios } from "../hooks/useHorarios";
import {
  DIA_SEMANA_LABELS,
  NIVEL_GRUPO,
  NIVEL_LABELS,
  type Curso,
  type DiaSemana,
  type EstadoCurso,
  type Horario,
  type NivelCurso,
} from "../types";

const cursoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  nivel: z.enum(["kids", "teens_a1", "teens_a2", "adults_b1", "adults_b2", "cambridge_prep"]),
  profesorId: z.string().min(1, "El curso debe tener un profesor asignado"),
  aula: z.string().optional(),
  cupo: z.coerce.number().int().positive("El cupo debe ser un número positivo"),
  horarios: z.array(
    z.object({
      diaSemana: z.enum(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]),
      horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido"),
      horaFin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido"),
    }),
  ),
});

type CursoForm = z.infer<typeof cursoSchema>;

const CUOTA_VARIANT: Record<EstadoCuota, "success" | "danger"> = {
  pagada: "success",
  vencida: "danger",
};
const CUOTA_LABELS: Record<EstadoCuota, string> = {
  pagada: "Al día",
  vencida: "Vencida",
};

export default function CursosAdminPage() {
  const { data: cursos, isLoading } = useCursos();
  const { data: profesores } = useProfesores();
  const { data: alumnos } = useAlumnos();
  const { data: horarios } = useHorarios();
  const { data: ciclos } = useCiclos();
  const crearCurso = useCrearCurso();
  const actualizarCurso = useActualizarCurso();

  const [busqueda, setBusqueda] = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [filtroProfesor, setFiltroProfesor] = useState("todos");
  // "activo" es un centinela (no un id real): sigue al ciclo que esté
  // marcado como activo en cada momento, en vez de quedar clavado al id del
  // ciclo que estaba activo cuando se abrió la pantalla.
  const [filtroCiclo, setFiltroCiclo] = useState<string>("activo");
  const cicloActivo = ciclos?.find((c) => c.activo);
  const [modal, setModal] = useState<{ mode: "new" } | { mode: "edit"; curso: Curso } | null>(null);
  const [estadoForm, setEstadoForm] = useState<EstadoCurso>("activo");
  const [verAlumnosDe, setVerAlumnosDe] = useState<Curso | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CursoForm>({ resolver: zodResolver(cursoSchema), defaultValues: { horarios: [] } });

  const { fields, append, remove } = useFieldArray({ control, name: "horarios" });

  const nombresPorProfesor = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const profesor of profesores ?? []) mapa.set(profesor.id, `${profesor.nombre} ${profesor.apellido ?? ""}`.trim());
    return mapa;
  }, [profesores]);

  const horariosPorCurso = useMemo(() => {
    const mapa = new Map<string, Horario[]>();
    for (const h of horarios ?? []) {
      const lista = mapa.get(h.cursoId) ?? [];
      lista.push(h);
      mapa.set(h.cursoId, lista);
    }
    return mapa;
  }, [horarios]);

  const alumnosPorCurso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of alumnos ?? []) {
      if (!a.cursoId) continue;
      mapa.set(a.cursoId, (mapa.get(a.cursoId) ?? 0) + 1);
    }
    return mapa;
  }, [alumnos]);

  const profesoresConCurso = useMemo(() => {
    const ids = new Set((cursos ?? []).map((c) => c.profesorId));
    return (profesores ?? []).filter((p) => ids.has(p.id));
  }, [cursos, profesores]);

  const filtrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    return (cursos ?? []).filter((c) => {
      const nombreProfesor = nombresPorProfesor.get(c.profesorId) ?? "";
      const matchTexto = !termino || normalizarTexto(`${c.nombre} ${nombreProfesor}`).includes(termino);
      const matchNivel = filtroNivel === "todos" || c.nivel === filtroNivel;
      const matchProfesor = filtroProfesor === "todos" || c.profesorId === filtroProfesor;
      const matchCiclo =
        filtroCiclo === "todos" || c.cicloId === (filtroCiclo === "activo" ? cicloActivo?.id : filtroCiclo);
      return matchTexto && matchNivel && matchProfesor && matchCiclo;
    });
  }, [cursos, busqueda, filtroNivel, filtroProfesor, filtroCiclo, cicloActivo, nombresPorProfesor]);

  const abrirNuevo = () => {
    reset({ nombre: "", profesorId: "", aula: "", cupo: 20, horarios: [{ diaSemana: "lunes", horaInicio: "18:00", horaFin: "19:30" }] });
    setEstadoForm("activo");
    setModal({ mode: "new" });
  };

  const abrirEditar = (curso: Curso) => {
    const horariosDelCurso = horariosPorCurso.get(curso.id) ?? [];
    reset({
      nombre: curso.nombre,
      nivel: curso.nivel,
      profesorId: curso.profesorId,
      aula: curso.aula ?? "",
      cupo: curso.cupo,
      horarios: horariosDelCurso.length
        ? horariosDelCurso.map((h) => ({ diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin }))
        : [{ diaSemana: "lunes", horaInicio: "18:00", horaFin: "19:30" }],
    });
    setEstadoForm(curso.estado);
    setModal({ mode: "edit", curso });
  };

  const onSubmit = handleSubmit(async (datos) => {
    if (modal?.mode === "edit") {
      await actualizarCurso.mutateAsync({ id: modal.curso.id, datos: { ...datos, estado: estadoForm } });
    } else {
      await crearCurso.mutateAsync(datos);
    }
    setModal(null);
  });

  const toggleEstado = (curso: Curso) => {
    actualizarCurso.mutate({ id: curso.id, datos: { estado: curso.estado === "activo" ? "inactivo" : "activo" } });
  };

  const guardando = crearCurso.isPending || actualizarCurso.isPending;
  const errorGuardado = crearCurso.error ?? actualizarCurso.error;

  if (verAlumnosDe) {
    return <NominaCurso curso={verAlumnosDe} onVolver={() => setVerAlumnosDe(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar curso o profesor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-64 pl-7"
            />
          </div>
          <Select value={filtroCiclo} onChange={(e) => setFiltroCiclo(e.target.value)} className="w-auto">
            <option value="activo">Ciclo activo{cicloActivo ? ` (${cicloActivo.anio})` : ""}</option>
            {ciclos
              ?.filter((c) => !c.activo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Histórico {c.anio}
                </option>
              ))}
            <option value="todos">Todos los ciclos</option>
          </Select>
          <Select value={filtroNivel} onChange={(e) => setFiltroNivel(e.target.value)} className="w-auto">
            <option value="todos">Todos los niveles</option>
            {(Object.entries(NIVEL_LABELS) as [NivelCurso, string][]).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Select>
          <Select value={filtroProfesor} onChange={(e) => setFiltroProfesor(e.target.value)} className="w-auto">
            <option value="todos">Todos los profesores</option>
            {profesoresConCurso.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellido ?? ""}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={abrirNuevo}>
          <Plus className="mr-1.5" size={14} /> Nuevo curso
        </Button>
      </div>

      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Nivel</th>
              <th>Profesor</th>
              <th>Horarios</th>
              <th>Alumnos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  Cargando cursos…
                </td>
              </tr>
            )}
            {!isLoading && filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay cursos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {filtrados.map((curso) => {
              const horariosDelCurso = horariosPorCurso.get(curso.id) ?? [];
              const count = alumnosPorCurso.get(curso.id) ?? 0;
              return (
                <tr key={curso.id}>
                  <td className="font-medium">{curso.nombre}</td>
                  <td>
                    <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{NIVEL_LABELS[curso.nivel]}</span>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{nombresPorProfesor.get(curso.profesorId) ?? "—"}</td>
                  <td>
                    {horariosDelCurso.length === 0 && <span className="text-muted-foreground">—</span>}
                    {horariosDelCurso.map((h) => (
                      <div key={h.id} className="tnum text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {DIA_SEMANA_LABELS[h.diaSemana]} {h.horaInicio}
                      </div>
                    ))}
                  </td>
                  <td className="tnum">
                    {count}/{curso.cupo}
                  </td>
                  <td>
                    <Badge variant={curso.estado === "activo" ? "success" : "neutral"}>
                      {curso.estado === "activo" ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                        onClick={() => abrirEditar(curso)}
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                        onClick={() => setVerAlumnosDe(curso)}
                        title="Ver alumnos"
                      >
                        <Users size={14} />
                      </button>
                      <button
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent"
                        onClick={() => toggleEstado(curso)}
                        title={curso.estado === "activo" ? "Marcar inactivo" : "Marcar activo"}
                      >
                        {curso.estado === "activo" ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal.mode === "new" ? "Nuevo curso" : "Editar curso"}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={guardando} onClick={onSubmit}>
                {guardando ? "Guardando…" : modal.mode === "new" ? "Crear curso" : "Guardar cambios"}
              </Button>
            </>
          }
        >
          <form className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3.5">
              <div className="col-span-2 space-y-1.5">
                <label className="label">Nombre del curso</label>
                <Input {...register("nombre")} placeholder="Ej: Teens A2 - Turno Tarde" />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">Nivel</label>
                <Select {...register("nivel")} defaultValue="">
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {(Object.entries(NIVEL_LABELS) as [NivelCurso, string][]).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Select>
                {errors.nivel && <p className="text-sm text-destructive">{errors.nivel.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">Aula</label>
                <Input {...register("aula")} placeholder="Aula 1" />
              </div>
              <div className="space-y-1.5">
                <label className="label">Profesor asignado</label>
                <Select {...register("profesorId")} defaultValue="">
                  <option value="" disabled>
                    Elegir…
                  </option>
                  {profesores?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.apellido ?? ""}
                    </option>
                  ))}
                </Select>
                {errors.profesorId && <p className="text-sm text-destructive">{errors.profesorId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">Cupo máximo</label>
                <Input type="number" min={1} max={60} {...register("cupo")} />
                {errors.cupo && <p className="text-sm text-destructive">{errors.cupo.message}</p>}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="label">Horarios de clase</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ diaSemana: "lunes", horaInicio: "18:00", horaFin: "19:30" })}
                >
                  <Plus size={12} className="mr-1" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Select {...register(`horarios.${index}.diaSemana`)} defaultValue={field.diaSemana} className="flex-2">
                      {(Object.entries(DIA_SEMANA_LABELS) as [DiaSemana, string][]).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>
                          {etiqueta}
                        </option>
                      ))}
                    </Select>
                    <Input type="time" {...register(`horarios.${index}.horaInicio`)} defaultValue={field.horaInicio} className="flex-1" />
                    <span className="text-muted-foreground">–</span>
                    <Input type="time" {...register(`horarios.${index}.horaFin`)} defaultValue={field.horaFin} className="flex-1" />
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="shrink-0 rounded p-1.5 text-destructive hover:bg-accent">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {modal.mode === "edit" && (
              <div>
                <label className="mb-1.5 block text-[12.5px] font-medium">Estado</label>
                <div className="flex gap-2">
                  {(["activo", "inactivo"] as EstadoCurso[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEstadoForm(v)}
                      className="flex-1 rounded px-3 py-2 text-[12.5px] font-medium transition-all"
                      style={{
                        border: `1px solid ${estadoForm === v ? "var(--brand)" : "var(--border-hex)"}`,
                        background: estadoForm === v ? "var(--brand-soft)" : "var(--bg)",
                        color: estadoForm === v ? "var(--brand)" : "var(--text)",
                      }}
                    >
                      {v === "activo" ? "Activo" : "Inactivo"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {errorGuardado && (
              <p className="text-sm text-destructive">
                {errorGuardado instanceof ApiError ? errorGuardado.message : "No se pudo guardar el curso"}
              </p>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

function NominaCurso({ curso, onVolver }: { curso: Curso; onVolver: () => void }) {
  const { data: alumnos } = useAlumnos();
  const { data: cuotas } = useCuotas();

  const alumnosDelCurso = useMemo(() => (alumnos ?? []).filter((a) => a.cursoId === curso.id), [alumnos, curso.id]);

  const estadoCuotaPorAlumno = useMemo(() => {
    const mapa = new Map<string, EstadoCuota>();
    for (const c of cuotas ?? []) {
      const actual = mapa.get(c.alumnoId);
      if (c.estado === "vencida") mapa.set(c.alumnoId, "vencida");
      else if (!actual) mapa.set(c.alumnoId, "pagada");
    }
    return mapa;
  }, [cuotas]);

  const asistenciaQueries = useQueries({
    queries: alumnosDelCurso.map((a) => ({
      queryKey: ["asistencia", "alumno", a.id],
      queryFn: () => asistenciaService.listarPorAlumno(a.id),
    })),
  });

  return (
    <div className="space-y-4">
      <button onClick={onVolver} className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Cursos <span className="text-muted-foreground">/</span> <span className="text-foreground">{curso.nombre}</span>
      </button>

      <Panel
        title={`Alumnos inscriptos — ${curso.nombre}`}
        action={
          <span className="tnum text-[12px] text-muted-foreground">
            {alumnosDelCurso.length}/{curso.cupo} alumnos
          </span>
        }
      >
        <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Cuota</th>
              <th>Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {alumnosDelCurso.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-muted-foreground">
                  Sin alumnos inscriptos
                </td>
              </tr>
            )}
            {alumnosDelCurso.map((alumno, i) => {
              const estadoCuota = estadoCuotaPorAlumno.get(alumno.id);
              const registros = asistenciaQueries[i]?.data ?? [];
              const pct = registros.length
                ? Math.round((registros.filter((r) => r.estado !== "ausente").length / registros.length) * 100)
                : null;
              return (
                <tr key={alumno.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="xs" />
                      <span className="font-medium">
                        {alumno.nombre} {alumno.apellido}
                      </span>
                    </div>
                  </td>
                  <td>
                    {estadoCuota ? (
                      <Badge variant={CUOTA_VARIANT[estadoCuota]}>{CUOTA_LABELS[estadoCuota]}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Sin cuotas</span>
                    )}
                  </td>
                  <td>
                    {pct === null ? (
                      <span className="text-sm text-muted-foreground">Sin registros</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--brand)" }} />
                        </div>
                        <span className="tnum text-[12px]">{pct}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Panel>
    </div>
  );
}
