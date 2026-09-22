import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Search, ToggleLeft, ToggleRight, UserPlus } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { ApiError } from "@/core/lib/apiClient";
import { formatDni, normalizarTexto } from "@/core/lib/utils";
import { useAlumnos } from "@/features/alumnos/hooks/useAlumnos";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { NIVEL_GRUPO, type Curso } from "@/features/cursos/types";
import { useActualizarProfesor } from "../hooks/useActualizarProfesor";
import { useCrearProfesor } from "../hooks/useCrearProfesor";
import { useProfesores } from "../hooks/useProfesores";
import type { EstadoProfesor, Profesor } from "../types";

// La contraseña solo se exige al crear (ver `onSubmit`): al editar no se pide,
// porque no hay flujo de cambio de contraseña y pisarla desde acá sería una
// operación distinta a "editar la ficha".
const profesorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  telefono: z.string().optional(),
  email: z.email("Email inválido"),
  password: z.string().optional(),
});
type ProfesorForm = z.infer<typeof profesorSchema>;

type ModalEstado = { mode: "new" } | { mode: "edit"; profesor: Profesor } | null;

const nombreCompleto = (p: Profesor) => `${p.nombre} ${p.apellido ?? ""}`.trim();

export default function ProfesoresAdminPage() {
  const { data: profesores, isLoading } = useProfesores();
  const { data: cursos } = useCursos();
  const { data: alumnos } = useAlumnos();
  const { data: ciclos } = useCiclos();
  const crearProfesor = useCrearProfesor();
  const actualizarProfesor = useActualizarProfesor();

  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalEstado>(null);
  const [estadoForm, setEstadoForm] = useState<EstadoProfesor>("activo");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProfesorForm>({ resolver: zodResolver(profesorSchema) });

  const cicloActivo = ciclos?.find((c) => c.activo);

  const cursosPorProfesor = useMemo(() => {
    const mapa = new Map<string, Curso[]>();
    for (const curso of cursos ?? []) {
      if (cicloActivo && curso.cicloId !== cicloActivo.id) continue;
      const lista = mapa.get(curso.profesorId) ?? [];
      lista.push(curso);
      mapa.set(curso.profesorId, lista);
    }
    return mapa;
  }, [cursos, cicloActivo]);

  const alumnosPorCurso = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of alumnos ?? []) {
      if (!a.cursoId) continue;
      mapa.set(a.cursoId, (mapa.get(a.cursoId) ?? 0) + 1);
    }
    return mapa;
  }, [alumnos]);

  const totalAlumnos = (profesorId: string) =>
    (cursosPorProfesor.get(profesorId) ?? []).reduce((suma, c) => suma + (alumnosPorCurso.get(c.id) ?? 0), 0);

  const profesoresFiltrados = useMemo(() => {
    if (!profesores) return [];
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return profesores;
    return profesores.filter((p) =>
      normalizarTexto(`${p.nombre} ${p.apellido ?? ""} ${p.dni ?? ""} ${p.email ?? ""}`).includes(termino),
    );
  }, [profesores, busqueda]);

  const abrirNuevo = () => {
    reset({ nombre: "", apellido: "", dni: "", telefono: "", email: "", password: "" });
    crearProfesor.reset();
    setModal({ mode: "new" });
  };

  const abrirEditar = (profesor: Profesor) => {
    reset({
      nombre: profesor.nombre,
      apellido: profesor.apellido ?? "",
      dni: profesor.dni ?? "",
      telefono: profesor.telefono ?? "",
      email: profesor.email ?? "",
      password: "",
    });
    actualizarProfesor.reset();
    setEstadoForm(profesor.estado);
    setModal({ mode: "edit", profesor });
  };

  const onSubmit = handleSubmit(async (datos) => {
    if (modal?.mode === "edit") {
      await actualizarProfesor.mutateAsync({
        id: modal.profesor.id,
        datos: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          dni: datos.dni,
          telefono: datos.telefono || undefined,
          email: datos.email,
          estado: estadoForm,
        },
      });
      setToast("Cambios guardados correctamente");
    } else {
      if (!datos.password || datos.password.length < 8) {
        setError("password", { message: "La contraseña debe tener al menos 8 caracteres" });
        return;
      }
      await crearProfesor.mutateAsync({ ...datos, password: datos.password });
      setToast(`Profesor ${datos.email} creado`);
    }
    setModal(null);
  });

  const alternarEstado = (profesor: Profesor) => {
    const nuevo: EstadoProfesor = profesor.estado === "activo" ? "inactivo" : "activo";
    actualizarProfesor.mutate(
      { id: profesor.id, datos: { estado: nuevo } },
      { onSuccess: () => setToast(`${nombreCompleto(profesor)} ahora está ${nuevo}`) },
    );
  };

  const guardando = crearProfesor.isPending || actualizarProfesor.isPending;
  const errorGuardado = crearProfesor.error ?? actualizarProfesor.error;

  const etiquetasCursos = (profesorId: string) => {
    const lista = cursosPorProfesor.get(profesorId) ?? [];
    if (lista.length === 0) return <span className="text-[12px] text-muted-foreground">Sin cursos asignados</span>;
    return lista.map((curso) => (
      <span key={curso.id} className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>
        {curso.nombre}
      </span>
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, DNI o email…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-[220px] pl-7"
          />
        </div>
        <Button onClick={abrirNuevo}>
          <UserPlus size={14} /> Nuevo profesor
        </Button>
      </div>

      <div className="card-hl hidden overflow-x-auto md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Profesor</th>
              <th>DNI</th>
              <th>Teléfono</th>
              <th>Cursos asignados</th>
              <th>Alumnos</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="h-20 text-center text-muted-foreground">
                  Cargando profesores…
                </td>
              </tr>
            )}
            {!isLoading && profesoresFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="h-20 text-center text-muted-foreground">
                  No se encontraron profesores.
                </td>
              </tr>
            )}
            {profesoresFiltrados.map((profesor) => (
              <tr key={profesor.id} style={{ opacity: profesor.estado === "inactivo" ? 0.55 : 1 }}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={nombreCompleto(profesor)} size="xs" tone="brand" />
                    <div>
                      <p className="font-medium">{nombreCompleto(profesor)}</p>
                      {profesor.email && (
                        <p className="font-mono text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {profesor.email}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="tnum font-mono" style={{ color: "var(--text-muted)" }}>
                  {profesor.dni ? formatDni(profesor.dni) : "—"}
                </td>
                <td className="tnum" style={{ color: "var(--text-muted)" }}>
                  {profesor.telefono ?? "—"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">{etiquetasCursos(profesor.id)}</div>
                </td>
                <td className="tnum">{totalAlumnos(profesor.id)}</td>
                <td>
                  <Badge variant={profesor.estado === "activo" ? "success" : "neutral"}>
                    {profesor.estado === "activo" ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
                <td style={{ textAlign: "right" }}>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Editar"
                      onClick={() => abrirEditar(profesor)}
                      className="rounded p-1.5 text-(--text-muted) hover:bg-(--bg-muted)"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      title={profesor.estado === "activo" ? "Desactivar" : "Activar"}
                      onClick={() => alternarEstado(profesor)}
                      disabled={actualizarProfesor.isPending}
                      className="rounded p-1.5 text-(--text-muted) hover:bg-(--bg-muted)"
                    >
                      {profesor.estado === "activo" ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2.5 md:hidden">
        {profesoresFiltrados.map((profesor) => (
          <div
            key={profesor.id}
            className="card-hl p-4"
            style={{ opacity: profesor.estado === "inactivo" ? 0.55 : 1 }}
          >
            <div className="flex items-center gap-3">
              <Avatar name={nombreCompleto(profesor)} size="md" tone="brand" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{nombreCompleto(profesor)}</p>
                {profesor.email && (
                  <p className="truncate font-mono text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                    {profesor.email}
                  </p>
                )}
              </div>
              <button
                onClick={() => abrirEditar(profesor)}
                className="rounded p-2 text-(--text-muted) hover:bg-(--bg-muted)"
              >
                <Pencil size={15} />
              </button>
            </div>
            <div
              className="mt-3 flex flex-wrap gap-1.5 border-t pt-3"
              style={{ borderColor: "var(--border-hex)" }}
            >
              {etiquetasCursos(profesor.id)}
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal
          title={modal.mode === "new" ? "Nuevo profesor" : "Editar profesor"}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={guardando} onClick={onSubmit}>
                {guardando ? "Guardando…" : modal.mode === "new" ? "Crear profesor" : "Guardar cambios"}
              </Button>
            </>
          }
        >
          <form className="space-y-4" noValidate onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="label">Nombre</label>
                <Input {...register("nombre")} />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">Apellido</label>
                <Input {...register("apellido")} />
                {errors.apellido && <p className="text-sm text-destructive">{errors.apellido.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">DNI</label>
                <Input {...register("dni")} className="font-mono" />
                {errors.dni && <p className="text-sm text-destructive">{errors.dni.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="label">Teléfono</label>
                <Input {...register("telefono")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="label">Email (login del sistema)</label>
                <Input type="email" {...register("email")} className="font-mono" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              {modal.mode === "new" && (
                <div className="col-span-2 space-y-1.5">
                  <label className="label">Contraseña de acceso</label>
                  <Input type="password" {...register("password")} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
              )}
            </div>

            {modal.mode === "edit" && (
              <div className="space-y-1.5">
                <label className="label">Estado</label>
                <div className="flex gap-2">
                  {(["activo", "inactivo"] as const).map((valor) => {
                    const activo = estadoForm === valor;
                    return (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setEstadoForm(valor)}
                        className="flex-1 rounded py-2 text-[12.5px] font-medium transition-all"
                        style={{
                          border: `1px solid ${activo ? "var(--brand)" : "var(--border-hex)"}`,
                          background: activo ? "var(--brand-soft)" : "var(--bg)",
                          color: activo ? "var(--brand)" : "var(--text)",
                        }}
                      >
                        {valor === "activo" ? "Activo" : "Inactivo"}
                      </button>
                    );
                  })}
                </div>
                {modal.profesor.usuarioId && estadoForm === "inactivo" && (
                  <p className="text-[11.5px] text-muted-foreground">
                    Un profesor inactivo no puede iniciar sesión.
                  </p>
                )}
              </div>
            )}

            {errorGuardado && (
              <p className="text-sm text-destructive">
                {errorGuardado instanceof ApiError ? errorGuardado.message : "No se pudo guardar el profesor"}
              </p>
            )}
          </form>
        </Modal>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[320px] -translate-x-1/2 items-center gap-2 rounded px-4 py-2.5 text-center text-[12.5px] font-medium"
          style={{ background: "var(--text)", color: "var(--bg)" }}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-dot)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
