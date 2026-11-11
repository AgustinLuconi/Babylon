import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { descartarCambiosSinGuardar, useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Select } from "@/core/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { erroresDeCampo } from "@/core/lib/erroresDeCampo";
import { calcularEdad, formatDni } from "@/core/lib/utils";
import {
  celularSchema,
  dniSchema,
  emailSchema,
  fechaNacimientoSchema,
  normalizarDni,
  opcional,
  textoOpcional,
  textoRequerido,
} from "@/core/lib/validacion";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { useActualizarPadre } from "@/features/padres/hooks/useActualizarPadre";
import { SelectorDeResponsable, type ResultadoDelSelector, type SelectorDeResponsableHandle } from "@/features/padres/components/SelectorDeResponsable";
import { VINCULO_LABELS } from "@/features/padres/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { useHorarios } from "@/features/cursos/hooks/useHorarios";
import { DIA_SEMANA_LABELS, NIVEL_GRUPO, NIVEL_LABELS } from "@/features/cursos/types";
import { useAlumnos } from "../hooks/useAlumnos";
import { useInscribirAlumno } from "../hooks/useInscribirAlumno";

const PASOS = [
  { n: 1, label: "Alumno" },
  { n: 2, label: "Curso" },
  { n: 3, label: "Responsable" },
  { n: 4, label: "Confirmar" },
] as const;
type Paso = 1 | 2 | 3 | 4;

// Lo mínimo para inscribir es nombre, apellido, curso y responsable: lo demás se puede completar después.
const alumnoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    dni: opcional(dniSchema),
    fechaNacimiento: opcional(fechaNacimientoSchema),
    calleNumero: textoOpcional(100),
    ciudad: textoOpcional(50),
    telefono: opcional(celularSchema),
    email: opcional(emailSchema),
    observacionesMedicas: textoOpcional(1000),
  })
  .superRefine((d, ctx) => {
    // La ficha guarda una sola dirección: se arma con calle y ciudad.
    if ([d.calleNumero, d.ciudad].filter(Boolean).join(", ").length > 150) {
      ctx.addIssue({ code: "custom", path: ["calleNumero"], message: "La dirección admite hasta 150 caracteres" });
    }
  });
type AlumnoForm = z.input<typeof alumnoSchema>;
const CAMPOS_DEL_ALUMNO = ["nombre", "apellido", "dni", "fechaNacimiento", "direccion", "telefono", "email", "observacionesMedicas"];

function Opcional() {
  return <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· opcional</span>;
}

const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");

export default function InscribirAlumnoPage() {
  const navigate = useNavigate();
  const { data: padres } = usePadres();
  const { data: cursos } = useCursos();
  const { data: horarios } = useHorarios();
  const { data: alumnos } = useAlumnos();
  const actualizarPadre = useActualizarPadre();
  const inscribirAlumno = useInscribirAlumno();
  const selector = useRef<SelectorDeResponsableHandle>(null);

  const [paso, setPaso] = useState<Paso>(1);
  const [cursoId, setCursoId] = useState("");
  const [resultado, setResultado] = useState<ResultadoDelSelector | null>(null);
  const [erroresDelServidor, setErroresDelServidor] = useState<Record<string, string>>({});
  const [errorPaso, setErrorPaso] = useState<string | null>(null);
  const [selectorModificado, setSelectorModificado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const alumnoForm = useForm<AlumnoForm>({ resolver: zodResolver(alumnoSchema), defaultValues: { ciudad: "San Luis" } });
  useSinGuardar(alumnoForm.formState.isDirty || selectorModificado || cursoId !== "");

  const cursoSeleccionado = useMemo(() => cursos?.find((c) => c.id === cursoId), [cursos, cursoId]);
  const horariosDelCurso = useMemo(() => (horarios ?? []).filter((h) => h.cursoId === cursoId), [horarios, cursoId]);

  const datosAlumno = alumnoForm.watch();
  const edad = calcularEdad(texto(datosAlumno.fechaNacimiento));
  // Un adulto puede ser responsable de sí mismo: por el nivel del curso o, si ya se cargó la fecha, por la edad.
  const esAdulto = Boolean(cursoSeleccionado?.nivel.startsWith("adults_")) || (edad !== null && edad >= 18);
  const alumnoParaElSelector = {
    nombre: texto(datosAlumno.nombre),
    apellido: texto(datosAlumno.apellido),
    dni: normalizarDni(texto(datosAlumno.dni)) ?? undefined,
  };

  const irAlSiguientePaso = async () => {
    setErrorPaso(null);
    if (paso === 1 && !(await alumnoForm.trigger())) return;
    if (paso === 2 && !cursoId) {
      setErrorPaso("Seleccioná un curso");
      return;
    }
    if (paso === 3) {
      const elegido = await selector.current?.validar();
      if (!elegido) return;
      setResultado(elegido);
    }
    setPaso((p) => (p < 4 ? ((p + 1) as Paso) : p));
  };
  const irAlPasoAnterior = () => setPaso((p) => (p > 1 ? ((p - 1) as Paso) : p));

  const onConfirmar = async () => {
    setErrorPaso(null);
    setErroresDelServidor({});
    const alumno = alumnoSchema.safeParse(alumnoForm.getValues());
    if (!alumno.success || !resultado) {
      setPaso(1);
      void alumnoForm.trigger();
      return;
    }
    const { calleNumero, ciudad, ...resto } = alumno.data;
    const direccion = [calleNumero, ciudad].filter(Boolean).join(", ") || undefined;
    setGuardando(true);
    try {
      // Una ficha que ya existía sin DNI y se eligió reutilizar: se le completa antes de inscribir.
      if (resultado.completarDni) {
        await actualizarPadre.mutateAsync({ id: resultado.completarDni.padreId, datos: { dni: resultado.completarDni.dni } });
      }
      await inscribirAlumno.mutateAsync({ ...resto, direccion, cursoId, responsable: resultado.responsable });
      // Ya se guardó: esta salida no pregunta.
      descartarCambiosSinGuardar();
      navigate("/alumnos");
    } catch (error) {
      repartirErrores(error);
    } finally {
      setGuardando(false);
    }
  };

  // Cada error del servidor al lado de su campo: los del alumno en el paso 1, los del responsable en el paso 3.
  const repartirErrores = (error: unknown) => {
    const { campos, general } = erroresDeCampo(error);
    const delResponsable: Record<string, string> = {};
    const sueltos: string[] = [];
    let alumnoConError = false;
    for (const [campo, mensaje] of Object.entries(campos)) {
      if (campo.startsWith("responsable") || (campo === "dni" && /responsable/i.test(mensaje))) delResponsable[campo] = mensaje;
      else if (CAMPOS_DEL_ALUMNO.includes(campo)) {
        alumnoForm.setError((campo === "direccion" ? "calleNumero" : campo) as keyof AlumnoForm, { message: mensaje });
        alumnoConError = true;
      } else sueltos.push(mensaje);
    }
    setErroresDelServidor(delResponsable);
    if (alumnoConError) setPaso(1);
    else if (Object.keys(delResponsable).length > 0) setPaso(3);
    setErrorPaso(general ?? (sueltos.length > 0 ? sueltos.join(" · ") : null));
  };

  const pendientes = (() => {
    const lista: string[] = [];
    if (!normalizarDni(texto(datosAlumno.dni))) lista.push("el DNI del alumno");
    if (!texto(datosAlumno.fechaNacimiento)) lista.push("su fecha de nacimiento");
    if (resultado?.responsable.tipo === "nuevo" && !resultado.responsable.datos.dni) lista.push("el DNI del responsable");
    if (resultado?.responsable.tipo === "nuevo" && !resultado.responsable.datos.email) lista.push("el email del responsable");
    if (resultado?.responsable.tipo === "propio" && !resultado.responsable.email) lista.push("su email");
    return lista;
  })();

  const responsableResumen = (() => {
    if (!resultado) return { titulo: "—", detalle: "" };
    const r = resultado.responsable;
    if (r.tipo === "existente") {
      const ficha = padres?.find((p) => p.id === r.padreId);
      return { titulo: ficha ? `${ficha.nombre} ${ficha.apellido}` : "—", detalle: VINCULO_LABELS[r.vinculo] };
    }
    if (r.tipo === "nuevo") {
      return { titulo: `${r.datos.nombre} ${r.datos.apellido}`, detalle: VINCULO_LABELS[r.vinculo] };
    }
    return { titulo: `${texto(datosAlumno.nombre)} ${texto(datosAlumno.apellido)}`, detalle: VINCULO_LABELS.propio };
  })();

  const error = erroresDeCampo(inscribirAlumno.error).general;

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
                  style={{ background: paso >= p.n ? "var(--brand)" : "var(--bg-muted)", color: paso >= p.n ? "#fff" : "var(--text-faint)" }}
                >
                  {paso > p.n ? <Check size={12} strokeWidth={2.5} /> : p.n}
                </div>
                <span className="hidden text-xs font-medium sm:inline" style={{ color: paso === p.n ? "var(--text)" : "var(--text-faint)" }}>
                  {p.label}
                </span>
              </div>
              {i < PASOS.length - 1 && <div className="mx-2 h-px flex-1" style={{ background: paso > p.n ? "var(--brand)" : "var(--border-hex)" }} />}
            </div>
          ))}
        </CardContent>
      </Card>

      {paso === 1 && (
        <Card className="p-5">
          <h3 className="mb-1 text-[14px] font-semibold">Datos del alumno</h3>
          <p className="mb-4 text-[12px]" style={{ color: "var(--text-muted)" }}>
            Alcanza con el nombre y el apellido: el resto se puede completar después.
          </p>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Valentina" {...alumnoForm.register("nombre")} />
              {alumnoForm.formState.errors.nombre && <p className="text-sm text-destructive">{alumnoForm.formState.errors.nombre.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="apellido">Apellido</Label>
              <Input id="apellido" placeholder="Rodríguez" {...alumnoForm.register("apellido")} />
              {alumnoForm.formState.errors.apellido && <p className="text-sm text-destructive">{alumnoForm.formState.errors.apellido.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dni">
                DNI <Opcional />
              </Label>
              <Input id="dni" placeholder="45123456" {...alumnoForm.register("dni")} />
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                7 u 8 números, con o sin puntos
              </p>
              {alumnoForm.formState.errors.dni && <p className="text-sm text-destructive">{alumnoForm.formState.errors.dni.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fechaNacimiento">
                Fecha de nacimiento <Opcional />
              </Label>
              <Input id="fechaNacimiento" type="date" {...alumnoForm.register("fechaNacimiento")} />
              {edad !== null && <p className="text-[12px] font-medium" style={{ color: "var(--brand)" }}>Edad calculada: {edad} años</p>}
              {alumnoForm.formState.errors.fechaNacimiento && <p className="text-sm text-destructive">{alumnoForm.formState.errors.fechaNacimiento.message}</p>}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="calleNumero">
                Calle y número <Opcional />
              </Label>
              <Input id="calleNumero" placeholder="Av. Illia 234" {...alumnoForm.register("calleNumero")} />
              {alumnoForm.formState.errors.calleNumero && <p className="text-sm text-destructive">{alumnoForm.formState.errors.calleNumero.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciudad">
                Ciudad <Opcional />
              </Label>
              <Input id="ciudad" {...alumnoForm.register("ciudad")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">
                Celular del alumno <Opcional />
              </Label>
              <Input id="telefono" placeholder="351 555-1234" {...alumnoForm.register("telefono")} />
              {alumnoForm.formState.errors.telefono && <p className="text-sm text-destructive">{alumnoForm.formState.errors.telefono.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email <Opcional />
              </Label>
              <Input id="email" type="email" {...alumnoForm.register("email")} />
              {alumnoForm.formState.errors.email && <p className="text-sm text-destructive">{alumnoForm.formState.errors.email.message}</p>}
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
              {alumnoForm.formState.errors.observacionesMedicas && <p className="text-sm text-destructive">{alumnoForm.formState.errors.observacionesMedicas.message}</p>}
            </div>
          </div>
        </Card>
      )}

      {paso === 2 && (
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
                  <span className={`level-pill ${NIVEL_GRUPO[cursoSeleccionado.nivel]}`}>{NIVEL_LABELS[cursoSeleccionado.nivel]}</span>
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

      {/* El selector se mantiene montado entre pasos: así no pierde lo que ya se eligió o se escribió. */}
      <div hidden={paso !== 3}>
        <Card>
          <CardHeader>
            <CardTitle>Responsable del alumno</CardTitle>
          </CardHeader>
          <CardContent>
            <SelectorDeResponsable
              ref={selector}
              padres={padres}
              alumnos={alumnos}
              esAdulto={esAdulto}
              alumno={alumnoParaElSelector}
              erroresDelServidor={erroresDelServidor}
              onModificado={setSelectorModificado}
            />
          </CardContent>
        </Card>
      </div>

      {paso === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Alumno</p>
                <p className="text-sm font-medium">
                  {texto(datosAlumno.nombre)} {texto(datosAlumno.apellido)}
                </p>
                <p className="text-xs text-muted-foreground">
                  DNI {formatDni(normalizarDni(texto(datosAlumno.dni)) ?? undefined)}
                  {edad !== null ? ` · ${edad} años` : ""}
                </p>
              </div>
              <div className="rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Responsable</p>
                <p className="text-sm font-medium">{responsableResumen.titulo}</p>
                <p className="text-xs text-muted-foreground">{responsableResumen.detalle}</p>
              </div>
              <div className="col-span-2 rounded-md border p-3" style={{ background: "var(--bg-subtle)" }}>
                <p className="eyebrow mb-1.5">Curso</p>
                <p className="text-sm font-medium">{cursoSeleccionado?.nombre ?? "—"}</p>
              </div>
            </div>
            {pendientes.length > 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                Quedan para completar después: {pendientes.join(", ")}. El alumno figurará en "Datos incompletos" hasta entonces.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {errorPaso && <p className="text-sm text-destructive">{errorPaso}</p>}
      {error && !errorPaso && <p className="text-sm text-destructive">{error}</p>}

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
