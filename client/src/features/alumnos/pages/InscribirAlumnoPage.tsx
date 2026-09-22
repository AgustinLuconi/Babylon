import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, UserPlus } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Select } from "@/core/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { ApiError } from "@/core/lib/apiClient";
import { calcularEdad, formatDni, normalizarTexto } from "@/core/lib/utils";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { useCrearPadre } from "@/features/padres/hooks/useCrearPadre";
import { VINCULO_LABELS, type Padre, type VinculoPadre } from "@/features/padres/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { useHorarios } from "@/features/cursos/hooks/useHorarios";
import { DIA_SEMANA_LABELS, NIVEL_GRUPO, NIVEL_LABELS } from "@/features/cursos/types";
import { useAlumnos } from "../hooks/useAlumnos";
import { useInscribirAlumno } from "../hooks/useInscribirAlumno";

const dniValido = (dni: string) => /^\d{7,8}$/.test(dni.replace(/\./g, ""));

const PASOS = [
  { n: 1, label: "Alumno" },
  { n: 2, label: "Tutor" },
  { n: 3, label: "Curso" },
  { n: 4, label: "Confirmar" },
] as const;

const alumnoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido").refine(dniValido, "DNI inválido (7-8 dígitos)"),
  fechaNacimiento: z.string().min(1, "La fecha de nacimiento es requerida"),
  calleNumero: z.string().optional(),
  ciudad: z.string().optional(),
  telefono: z.string().optional(),
  email: z.union([z.email("Email inválido"), z.literal("")]).optional(),
  observacionesMedicas: z.string().optional(),
});

type AlumnoForm = z.infer<typeof alumnoSchema>;

const nuevoPadreSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido").refine(dniValido, "DNI inválido (7-8 dígitos)"),
  telefono: z.string().optional(),
  email: z.email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  vinculo: z.enum(["padre", "madre", "tutor"]),
});

type NuevoPadreForm = z.infer<typeof nuevoPadreSchema>;

function Opcional() {
  return (
    <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· opcional</span>
  );
}

export default function InscribirAlumnoPage() {
  const navigate = useNavigate();
  const { data: padres } = usePadres();
  const { data: cursos } = useCursos();
  const { data: horarios } = useHorarios();
  const { data: alumnos } = useAlumnos();
  const crearPadre = useCrearPadre();
  const inscribirAlumno = useInscribirAlumno();

  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [modoPadre, setModoPadre] = useState<"buscar" | "crear">("buscar");
  const [busquedaPadre, setBusquedaPadre] = useState("");
  const [padreSeleccionado, setPadreSeleccionado] = useState<Padre | null>(null);
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const [cursoId, setCursoId] = useState("");

  const alumnoForm = useForm<AlumnoForm>({ resolver: zodResolver(alumnoSchema) });
  const padreForm = useForm<NuevoPadreForm>({ resolver: zodResolver(nuevoPadreSchema) });

  const padresFiltrados = useMemo(() => {
    if (!padres) return [];
    const termino = normalizarTexto(busquedaPadre.trim());
    if (!termino) return padres;
    return padres.filter((p) => normalizarTexto(`${p.nombre} ${p.apellido} ${p.dni}`).includes(termino));
  }, [padres, busquedaPadre]);

  const cursoSeleccionado = useMemo(() => cursos?.find((c) => c.id === cursoId), [cursos, cursoId]);
  const horariosDelCurso = useMemo(() => (horarios ?? []).filter((h) => h.cursoId === cursoId), [horarios, cursoId]);

  const hermanosDelPadreSeleccionado = useMemo(() => {
    if (modoPadre !== "buscar" || !padreSeleccionado || !alumnos) return [];
    return alumnos.filter((a) => a.padreId === padreSeleccionado.id && a.estado === "activo");
  }, [modoPadre, padreSeleccionado, alumnos]);

  const datosAlumno = alumnoForm.watch();
  const edad = calcularEdad(datosAlumno.fechaNacimiento ?? "");

  const cambiarModoPadre = (modo: "buscar" | "crear") => {
    setModoPadre(modo);
    setErrorPaso(null);
  };

  const irAlSiguientePaso = async () => {
    setErrorPaso(null);
    if (paso === 1) {
      const valido = await alumnoForm.trigger();
      if (!valido) return;
    }
    if (paso === 2) {
      if (modoPadre === "buscar" && !padreSeleccionado) {
        setErrorPaso("Elegí un padre/madre/tutor existente o cargá uno nuevo");
        return;
      }
      if (modoPadre === "crear") {
        const valido = await padreForm.trigger();
        if (!valido) return;
      }
    }
    if (paso === 3 && !cursoId) {
      setErrorPaso("Seleccioná un curso");
      return;
    }
    setPaso((p) => (p < 4 ? ((p + 1) as 1 | 2 | 3 | 4) : p));
  };

  const irAlPasoAnterior = () => setPaso((p) => (p > 1 ? ((p - 1) as 1 | 2 | 3 | 4) : p));

  const onConfirmar = async () => {
    setErrorPaso(null);
    let padreId = padreSeleccionado?.id;

    if (modoPadre === "crear") {
      const nuevoPadre = await crearPadre.mutateAsync(padreForm.getValues());
      padreId = nuevoPadre.id;
    }
    if (!padreId) {
      setErrorPaso("Elegí un padre/madre/tutor existente o cargá uno nuevo");
      return;
    }

    const datos = alumnoForm.getValues();
    // La ficha guarda una sola dirección: se arma con calle y ciudad.
    const { calleNumero, ciudad, ...resto } = datos;
    const direccion = [calleNumero, ciudad].map((t) => t?.trim()).filter(Boolean).join(", ") || undefined;
    await inscribirAlumno.mutateAsync({
      ...resto,
      direccion,
      email: datos.email || undefined,
      padreId,
      cursoId,
    });
    navigate("/alumnos");
  };

  const guardando = inscribirAlumno.isPending || crearPadre.isPending;
  const error = inscribirAlumno.error ?? crearPadre.error;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/alumnos")}>
          <ArrowLeft size={16} />
        </Button>
        <div>
          <p className="eyebrow">Nuevo ingreso</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Inscribir alumno</h2>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center py-4">
          {PASOS.map((p, i) => (
            <div key={p.n} className="flex flex-1 items-center last:flex-none">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold"
                  style={{
                    background: paso >= p.n ? "var(--brand)" : "var(--bg-muted)",
                    color: paso >= p.n ? "#fff" : "var(--text-faint)",
                  }}
                >
                  {paso > p.n ? <Check size={12} strokeWidth={2.5} /> : p.n}
                </div>
                <span
                  className="hidden text-xs font-medium sm:inline"
                  style={{ color: paso === p.n ? "var(--text)" : "var(--text-faint)" }}
                >
                  {p.label}
                </span>
              </div>
              {i < PASOS.length - 1 && (
                <div className="mx-2 h-px flex-1" style={{ background: paso > p.n ? "var(--brand)" : "var(--border-hex)" }} />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {paso === 1 && (
        <Card className="p-5">
          <h3 className="mb-4 text-[14px] font-semibold">Datos del alumno</h3>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Valentina" {...alumnoForm.register("nombre")} />
              {alumnoForm.formState.errors.nombre && (
                <p className="text-sm text-destructive">{alumnoForm.formState.errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" placeholder="Rodríguez" {...alumnoForm.register("apellido")} />
              {alumnoForm.formState.errors.apellido && (
                <p className="text-sm text-destructive">{alumnoForm.formState.errors.apellido.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dni">DNI</Label>
              <Input id="dni" placeholder="45123456" {...alumnoForm.register("dni")} />
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Solo números, sin puntos
              </p>
              {alumnoForm.formState.errors.dni && (
                <p className="text-sm text-destructive">{alumnoForm.formState.errors.dni.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaNacimiento">Fecha de nacimiento</Label>
              <Input id="fechaNacimiento" type="date" {...alumnoForm.register("fechaNacimiento")} />
              {edad !== null && <p className="text-[12px] font-medium" style={{ color: "var(--brand)" }}>Edad calculada: {edad} años</p>}
              {alumnoForm.formState.errors.fechaNacimiento && (
                <p className="text-sm text-destructive">{alumnoForm.formState.errors.fechaNacimiento.message}</p>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="calleNumero">Calle y número</Label>
              <Input id="calleNumero" placeholder="Av. Illia 234" {...alumnoForm.register("calleNumero")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" {...alumnoForm.register("ciudad")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">
                Teléfono <Opcional />
              </Label>
              <Input id="telefono" placeholder="2664-123456" {...alumnoForm.register("telefono")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <Opcional />
              </Label>
              <Input id="email" type="email" {...alumnoForm.register("email")} />
              {alumnoForm.formState.errors.email && (
                <p className="text-sm text-destructive">{alumnoForm.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="observacionesMedicas">
                Observaciones médicas / alergias <Opcional />
              </Label>
              <textarea
                id="observacionesMedicas"
                rows={3}
                placeholder="Ej: alergia a la penicilina, asma, diabetes…"
                className="flex w-full resize-none rounded-md border border-input bg-background p-2.5 text-[13.5px] leading-[1.55] placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                {...alumnoForm.register("observacionesMedicas")}
              />
            </div>
          </div>
        </Card>
      )}

      {paso === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Datos del padre / tutor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>¿El padre o tutor ya tiene cuenta en el sistema?</Label>
              <div className="mt-1.5 flex gap-2">
                {(
                  [
                    ["buscar", "Sí, ya existe"],
                    ["crear", "No, crear nuevo"],
                  ] as const
                ).map(([modo, etiqueta]) => {
                  const activo = modoPadre === modo;
                  return (
                    <button
                      key={modo}
                      type="button"
                      onClick={() => cambiarModoPadre(modo)}
                      className="flex-1 rounded py-2.5 text-[13px] font-medium transition-all"
                      style={{
                        border: `1px solid ${activo ? "var(--brand)" : "var(--border-hex)"}`,
                        background: activo ? "var(--brand-soft)" : "var(--bg)",
                        color: activo ? "var(--brand)" : "var(--text)",
                      }}
                    >
                      {etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            {modoPadre === "buscar" ? (
              <div className="space-y-3">
                <div>
                  <Label>Buscar padre / tutor</Label>
                  <div className="relative mt-1.5">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
                    <Input
                      placeholder="Nombre, email o DNI…"
                      className="pl-7"
                      value={busquedaPadre}
                      onChange={(e) => setBusquedaPadre(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded border" style={{ borderColor: "var(--border-hex)" }}>
                  {padresFiltrados.length === 0 && (
                    <p className="px-4 py-4 text-center text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                      Sin resultados
                    </p>
                  )}
                  {padresFiltrados.map((padre, i) => {
                    const seleccionado = padreSeleccionado?.id === padre.id;
                    const hijos = (alumnos ?? []).filter((a) => a.padreId === padre.id && a.estado === "activo").length;
                    return (
                      <button
                        type="button"
                        key={padre.id}
                        onClick={() => setPadreSeleccionado(padre)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all"
                        style={{ background: seleccionado ? "var(--brand-soft)" : i % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)" }}
                      >
                        <Avatar name={`${padre.nombre} ${padre.apellido}`} size="xs" tone={seleccionado ? "brand" : "neutral"} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium" style={{ color: seleccionado ? "var(--brand)" : "var(--text)" }}>
                            {padre.nombre} {padre.apellido}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                            {hijos} hijo{hijos !== 1 ? "s" : ""} inscripto{hijos !== 1 ? "s" : ""} · DNI {formatDni(padre.dni)}
                          </p>
                        </div>
                        {seleccionado && <Check size={13} className="shrink-0" style={{ color: "var(--brand)" }} />}
                      </button>
                    );
                  })}
                </div>
                {hermanosDelPadreSeleccionado.length > 0 && (
                  <div
                    className="flex items-start gap-2 rounded-md border p-3"
                    style={{ background: "var(--brand-soft)", borderColor: "var(--brand-border)" }}
                  >
                    <p className="text-[12.5px]" style={{ color: "var(--brand)" }}>
                      Este tutor ya tiene {hermanosDelPadreSeleccionado.length} hijo
                      {hermanosDelPadreSeleccionado.length !== 1 ? "s" : ""} inscripto
                      {hermanosDelPadreSeleccionado.length !== 1 ? "s" : ""} (
                      {hermanosDelPadreSeleccionado.map((h) => h.nombre).join(", ")}). Se aplicará{" "}
                      <strong>descuento del 10%</strong> sobre la cuota de este alumno.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="padreNombre">Nombre</Label>
                    <Input id="padreNombre" {...padreForm.register("nombre")} />
                    {padreForm.formState.errors.nombre && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.nombre.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="padreApellido">Apellido</Label>
                    <Input id="padreApellido" {...padreForm.register("apellido")} />
                    {padreForm.formState.errors.apellido && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.apellido.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="padreDni">DNI</Label>
                    <Input id="padreDni" placeholder="28456123" {...padreForm.register("dni")} />
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>7-8 dígitos</p>
                    {padreForm.formState.errors.dni && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.dni.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vinculo">Vínculo</Label>
                    <Select id="vinculo" {...padreForm.register("vinculo")} defaultValue="">
                      <option value="" disabled>
                        Elegir…
                      </option>
                      {(Object.entries(VINCULO_LABELS) as [VinculoPadre, string][]).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>
                          {etiqueta}
                        </option>
                      ))}
                    </Select>
                    {padreForm.formState.errors.vinculo && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.vinculo.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="padreTelefono">Teléfono</Label>
                    <Input id="padreTelefono" placeholder="2664-456789" {...padreForm.register("telefono")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="padreEmail">Email (login del sistema)</Label>
                    <Input id="padreEmail" type="email" {...padreForm.register("email")} />
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>Será el usuario de acceso al sistema</p>
                    {padreForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{padreForm.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="padrePassword">Contraseña de acceso</Label>
                  <Input id="padrePassword" type="password" {...padreForm.register("password")} />
                  {padreForm.formState.errors.password && (
                    <p className="text-sm text-destructive">{padreForm.formState.errors.password.message}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {paso === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Curso</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="curso">Curso</Label>
              <Select id="curso" value={cursoId} onChange={(e) => setCursoId(e.target.value)}>
                <option value="">Seleccioná un curso…</option>
                {cursos?.map((curso) => (
                  <option key={curso.id} value={curso.id}>
                    {curso.nombre} — {NIVEL_LABELS[curso.nivel]}
                    {curso.aula ? ` — ${curso.aula}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            {cursoSeleccionado && (
              <div className="space-y-2 rounded-md border p-4" style={{ background: "var(--bg-subtle)" }}>
                <div className="flex items-center gap-2">
                  <span className={`level-pill ${NIVEL_GRUPO[cursoSeleccionado.nivel]}`}>
                    {NIVEL_LABELS[cursoSeleccionado.nivel]}
                  </span>
                  <span className="text-sm font-semibold">{cursoSeleccionado.nombre}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {cursoSeleccionado.aula && <div>Aula {cursoSeleccionado.aula}</div>}
                  <div>Cupo {cursoSeleccionado.cupo}</div>
                </div>
                {horariosDelCurso.length > 0 && (
                  <div className="mt-2.5 space-y-1">
                    {horariosDelCurso.map((h) => (
                      <div key={h.id} className="text-xs text-muted-foreground">
                        {DIA_SEMANA_LABELS[h.diaSemana]} <span className="tnum">{h.horaInicio} – {h.horaFin}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {paso === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Alumno</p>
                <p className="text-sm font-medium">
                  {datosAlumno.nombre} {datosAlumno.apellido}
                </p>
                <p className="text-xs text-muted-foreground">
                  DNI {datosAlumno.dni}
                  {edad !== null ? ` · ${edad} años` : ""}
                </p>
              </div>
              <div className="rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Padre/Madre/Tutor</p>
                <p className="text-sm font-medium">
                  {modoPadre === "buscar" && padreSeleccionado
                    ? `${padreSeleccionado.nombre} ${padreSeleccionado.apellido}`
                    : `${padreForm.getValues("nombre")} ${padreForm.getValues("apellido")}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {modoPadre === "buscar" && padreSeleccionado ? padreSeleccionado.email : padreForm.getValues("email")}
                </p>
              </div>
              <div className="col-span-2 rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Curso</p>
                <p className="text-sm font-medium">{cursoSeleccionado?.nombre ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {errorPaso && <p className="text-sm text-destructive">{errorPaso}</p>}
      {error && (
        <p className="text-sm text-destructive">
          {error instanceof ApiError ? error.message : "No se pudo completar la inscripción"}
        </p>
      )}

      <div className="flex gap-2">
        {paso > 1 && (
          <Button type="button" variant="outline" onClick={irAlPasoAnterior}>
            <ChevronLeft size={14} /> Volver
          </Button>
        )}
        {paso < 4 ? (
          <Button type="button" className="flex-1 justify-center" onClick={irAlSiguientePaso}>
            Siguiente <ChevronRight size={14} />
          </Button>
        ) : (
          <Button type="button" className="flex-1 justify-center" disabled={guardando} onClick={onConfirmar}>
            <UserPlus size={14} /> {guardando ? "Guardando..." : "Confirmar inscripción"}
          </Button>
        )}
      </div>
    </div>
  );
}
