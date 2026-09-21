import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSignature, FileText, PenLine, Pencil, Plus, RefreshCw, Send, Upload, UserCheck, UserX } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Avatar } from "@/core/components/ui/avatar";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Modal } from "@/core/components/ui/modal";
import { Panel } from "@/core/components/ui/panel";
import { Select } from "@/core/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/components/ui/table";
import { ApiError } from "@/core/lib/apiClient";
import { calcularEdad, formatDni, formatFecha, formatMonto } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { AttendanceCalendar } from "@/features/asistencia/components/AttendanceCalendar";
import { useAsistenciaDeAlumno } from "@/features/asistencia/hooks/useAsistenciaDeAlumno";
import { useCalificacionesDeAlumno } from "@/features/calificaciones/hooks/useCalificacionesDeAlumno";
import { useNotasCierreDeAlumno } from "@/features/calificaciones/hooks/useNotasCierreDeAlumno";
import { PERIODO_LABELS, TIPO_EVALUACION_LABELS, type PeriodoAcademico } from "@/features/calificaciones/types";
import { NIVEL_GRUPO, NIVEL_LABELS } from "@/features/cursos/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { useCuotasPorAlumno } from "@/features/cuotas/hooks/useCuotasPorAlumno";
import { useRegistrarPago } from "@/features/cuotas/hooks/useRegistrarPago";
import { METODO_PAGO_LABELS, type Cuota, type EstadoCuota, type MetodoPago } from "@/features/cuotas/types";
import { useDocumentosPorAlumno } from "@/features/documentos/hooks/useDocumentosPorAlumno";
import { useMarcarAutorizacionManual } from "@/features/documentos/hooks/useMarcarAutorizacionManual";
import { useMarcarCargado } from "@/features/documentos/hooks/useMarcarCargado";
import { useRevocarAutorizacion } from "@/features/documentos/hooks/useRevocarAutorizacion";
import { TEXTO_LEGAL_AUTORIZACION_IMAGEN } from "@/features/documentos/textoLegalAutorizacion";
import { ORDEN_DOCUMENTOS, TIPO_DOCUMENTO_LABELS, type Documento } from "@/features/documentos/types";
import { useCategoriasPersonalizadas } from "@/features/observaciones/hooks/useCategoriasPersonalizadas";
import { useCrearObservacion } from "@/features/observaciones/hooks/useCrearObservacion";
import { useObservacionesPorAlumno } from "@/features/observaciones/hooks/useObservacionesPorAlumno";
import { CATEGORIA_LABELS } from "@/features/observaciones/types";
import { useActualizarPadre } from "@/features/padres/hooks/useActualizarPadre";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { VINCULO_LABELS, type VinculoPadre } from "@/features/padres/types";
import { useActualizarAlumno } from "../hooks/useActualizarAlumno";
import { useAlumnos } from "../hooks/useAlumnos";
import { ESTADO_ALUMNO_LABELS, ESTADO_ALUMNO_VARIANT } from "../types";

const CUOTA_VARIANT: Record<EstadoCuota, "success" | "danger"> = {
  pagada: "success",
  vencida: "danger",
};
const CUOTA_LABELS: Record<EstadoCuota, string> = {
  pagada: "Al día",
  vencida: "Vencida",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const TABS = [
  { id: "info", label: "Información" },
  { id: "academico", label: "Académico" },
  { id: "asistencia", label: "Asistencia" },
  { id: "cuotas", label: "Cuotas" },
  { id: "observaciones", label: "Observaciones" },
] as const;
type TabId = (typeof TABS)[number]["id"];


function Campo({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-b-0" style={{ borderColor: "var(--border-hex)" }}>
      <span className="flex-shrink-0 text-[12px]" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <span className={`text-right text-[13px] ${mono ? "mono tnum" : ""}`}>
        {value || <span style={{ color: "var(--text-faint)" }}>—</span>}
      </span>
    </div>
  );
}

export default function AlumnoDetailPage() {
  const { id: alumnoId } = useParams<{ id: string }>();
  const { usuario } = useAuth();
  const puedeGestionar = usuario?.rol === "admin";
  const [tab, setTab] = useState<TabId>("info");
  const [toast, setToast] = useState("");

  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    setTimeout(() => setToast(""), 2600);
  };

  const { data: alumnos } = useAlumnos();
  const alumno = useMemo(() => alumnos?.find((a) => a.id === alumnoId), [alumnos, alumnoId]);
  const { data: padres } = usePadres();
  const padre = useMemo(() => padres?.find((p) => p.id === alumno?.padreId), [padres, alumno]);
  const hermanos = useMemo(
    () => (alumnos ?? []).filter((a) => alumno?.padreId && a.padreId === alumno.padreId && a.id !== alumno.id),
    [alumnos, alumno],
  );
  const { data: cursos } = useCursos();
  const curso = useMemo(() => cursos?.find((c) => c.id === alumno?.cursoId), [cursos, alumno]);

  const edad = alumno ? calcularEdad(alumno.fechaNacimiento) : null;
  const antiguedad = alumno ? calcularEdad(alumno.fechaInscripcion) : null;

  // Académico
  const { data: calificaciones, isLoading: cargandoNotas } = useCalificacionesDeAlumno(alumnoId);
  const { data: notasCierre, isLoading: cargandoNotasCierre } = useNotasCierreDeAlumno(alumnoId);
  const [periodo, setPeriodo] = useState<PeriodoAcademico>("julio");
  const evalsDelPeriodo = useMemo(
    () => (calificaciones ?? []).filter((c) => c.evaluacionPeriodo === periodo),
    [calificaciones, periodo],
  );
  const promedioPeriodo = useMemo(() => {
    const notas = evalsDelPeriodo.map((c) => Number(c.nota)).filter((n) => !Number.isNaN(n));
    return notas.length > 0 ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : "—";
  }, [evalsDelPeriodo]);
  const notaCierrePeriodo = useMemo(() => notasCierre?.find((n) => n.periodo === periodo), [notasCierre, periodo]);

  // Asistencia
  const { data: asistencias, isLoading: cargandoAsistencia } = useAsistenciaDeAlumno(alumnoId);
  const mesesConRegistros = useMemo(() => {
    const mapa = new Map<string, { anio: number; mes: number }>();
    for (const a of asistencias ?? []) {
      const [anio, mes] = a.fecha.slice(0, 10).split("-").map(Number);
      mapa.set(`${anio}-${mes}`, { anio, mes });
    }
    return Array.from(mapa.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  }, [asistencias]);
  const [mesAsistencia, setMesAsistencia] = useState<{ anio: number; mes: number } | null>(null);
  useEffect(() => {
    if (mesAsistencia) return;
    if (mesesConRegistros.length > 0) {
      setMesAsistencia(mesesConRegistros[0]);
      return;
    }
    const ahora = new Date();
    setMesAsistencia({ anio: ahora.getFullYear(), mes: ahora.getMonth() + 1 });
  }, [mesesConRegistros, mesAsistencia]);
  const registrosDelMes = useMemo(() => {
    if (!mesAsistencia) return [];
    return (asistencias ?? []).filter((a) => {
      const [anio, mes] = a.fecha.slice(0, 10).split("-").map(Number);
      return anio === mesAsistencia.anio && mes === mesAsistencia.mes;
    });
  }, [asistencias, mesAsistencia]);
  const cambiarMesAsistencia = (delta: number) => {
    setMesAsistencia((actual) => {
      if (!actual) return actual;
      let mes = actual.mes + delta;
      let anio = actual.anio;
      if (mes < 1) {
        mes = 12;
        anio -= 1;
      } else if (mes > 12) {
        mes = 1;
        anio += 1;
      }
      return { anio, mes };
    });
  };

  const presentes = registrosDelMes.filter((a) => a.estado === "presente").length;
  const tardanzas = registrosDelMes.filter((a) => a.estado === "tarde").length;
  const ausencias = registrosDelMes.filter((a) => a.estado === "ausente").length;
  const pctPresencia = registrosDelMes.length > 0 ? Math.round((presentes / registrosDelMes.length) * 100) : 0;

  // Cuotas
  const { data: cuotas, isLoading: cargandoCuotas } = useCuotasPorAlumno(alumnoId ?? null);
  const [cuotaIdsSeleccionadas, setCuotaIdsSeleccionadas] = useState<string[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const registrarPago = useRegistrarPago();
  const toggleCuota = (cuotaId: string) => {
    setCuotaIdsSeleccionadas((actual) =>
      actual.includes(cuotaId) ? actual.filter((id) => id !== cuotaId) : [...actual, cuotaId],
    );
  };
  const onRegistrarPago = async () => {
    if (cuotaIdsSeleccionadas.length === 0) return;
    await registrarPago.mutateAsync({ cuotaIds: cuotaIdsSeleccionadas, metodo });
    setCuotaIdsSeleccionadas([]);
  };

  // Observaciones
  const { data: observaciones, isLoading: cargandoObservaciones } = useObservacionesPorAlumno(alumnoId);
  const { data: categoriasPersonalizadas } = useCategoriasPersonalizadas(alumno?.cursoId);
  const nombresPorCategoria = useMemo(() => {
    const mapa = new Map<string, string>(Object.entries(CATEGORIA_LABELS));
    for (const categoria of categoriasPersonalizadas ?? []) mapa.set(categoria.id, categoria.nombre);
    return mapa;
  }, [categoriasPersonalizadas]);
  const [obsFiltro, setObsFiltro] = useState("all");
  const observacionesVisibles = useMemo(
    () => (obsFiltro === "all" ? observaciones : observaciones?.filter((o) => o.categoria === obsFiltro)),
    [observaciones, obsFiltro],
  );
  const [modalObs, setModalObs] = useState(false);
  const [obsCategoria, setObsCategoria] = useState<string>("academico");
  const [obsTexto, setObsTexto] = useState("");
  const crearObservacion = useCrearObservacion();
  const abrirModalObs = () => {
    setObsCategoria("academico");
    setObsTexto("");
    setModalObs(true);
  };
  const onEnviarObs = () => {
    if (!alumnoId || !obsTexto.trim()) return;
    crearObservacion.mutate(
      { alumnoId, texto: obsTexto.trim(), categoria: obsCategoria },
      {
        onSuccess: () => {
          setModalObs(false);
          mostrarToast("Observación enviada al tutor");
        },
      },
    );
  };

  // Documentación
  const { data: documentos } = useDocumentosPorAlumno(alumnoId);
  const marcarCargado = useMarcarCargado();
  const marcarManual = useMarcarAutorizacionManual();
  const revocar = useRevocarAutorizacion();
  const verArchivo = (doc: Documento | undefined) => {
    if (!doc?.urlArchivo) {
      mostrarToast("No hay ningún archivo cargado");
      return;
    }
    window.open(doc.urlArchivo, "_blank");
  };

  // Editar datos (modal)
  const actualizarAlumno = useActualizarAlumno();
  const actualizarPadre = useActualizarPadre();
  const [modalEditar, setModalEditar] = useState(false);
  const [formAlumno, setFormAlumno] = useState({
    nombre: "", apellido: "", direccion: "", telefono: "", email: "", observacionesMedicas: "",
  });
  const [formPadre, setFormPadre] = useState({
    nombre: "", apellido: "", direccion: "", telefono: "", email: "", vinculo: "padre" as VinculoPadre,
  });
  const abrirEditar = () => {
    if (!alumno) return;
    setFormAlumno({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      direccion: alumno.direccion ?? "",
      telefono: alumno.telefono ?? "",
      email: alumno.email ?? "",
      observacionesMedicas: alumno.observacionesMedicas ?? "",
    });
    if (padre) {
      setFormPadre({
        nombre: padre.nombre,
        apellido: padre.apellido,
        direccion: padre.direccion ?? "",
        telefono: padre.telefono ?? "",
        email: padre.email ?? "",
        vinculo: padre.vinculo,
      });
    }
    setModalEditar(true);
  };
  const guardandoEdicion = actualizarAlumno.isPending || actualizarPadre.isPending;
  const errorEdicion = actualizarAlumno.error ?? actualizarPadre.error;
  const onGuardarEdicion = async () => {
    if (!alumno) return;
    await actualizarAlumno.mutateAsync({ id: alumno.id, datos: { ...formAlumno } });
    if (padre) {
      await actualizarPadre.mutateAsync({ id: padre.id, datos: { ...formPadre } });
    }
    setModalEditar(false);
    mostrarToast("Datos actualizados");
  };

  // Desactivar / reactivar alumno
  const [confirmarEstado, setConfirmarEstado] = useState(false);
  const onConfirmarEstado = () => {
    if (!alumno) return;
    const nuevoEstado = alumno.estado === "activo" ? "inactivo" : "activo";
    actualizarAlumno.mutate(
      { id: alumno.id, datos: { estado: nuevoEstado } },
      {
        onSuccess: () => {
          setConfirmarEstado(false);
          mostrarToast(nuevoEstado === "inactivo" ? "Alumno desactivado" : "Alumno reactivado");
        },
      },
    );
  };

  const estadoCuotaActual = useMemo(() => {
    if (!cuotas || cuotas.length === 0) return undefined;
    if (cuotas.some((c) => c.estado === "vencida")) return "vencida" as const;
    return "pagada" as const;
  }, [cuotas]);

  if (!alumno) {
    return <p className="text-muted-foreground">Cargando alumno…</p>;
  }

  return (
    <div className="space-y-5">
      <Link to="/alumnos" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft size={14} /> Alumnos
        <span>/</span>
        <span className="text-foreground">
          {alumno.nombre} {alumno.apellido}
        </span>
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
          <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="lg" tone="brand" />
          <div className="flex-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {alumno.nombre} {alumno.apellido}
            </h2>
            <p className="mono tnum text-sm text-muted-foreground">DNI {formatDni(alumno.dni)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{NIVEL_LABELS[curso.nivel]}</span>}
              {estadoCuotaActual && <Badge variant={CUOTA_VARIANT[estadoCuotaActual]}>{CUOTA_LABELS[estadoCuotaActual]}</Badge>}
              <Badge variant={ESTADO_ALUMNO_VARIANT[alumno.estado]}>{ESTADO_ALUMNO_LABELS[alumno.estado]}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <Button variant="outline" size="sm" onClick={abrirEditar}>
              <Pencil className="mr-1.5" size={14} /> Editar datos
            </Button>
            {puedeGestionar && (
              <>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <FileText className="mr-1.5" size={14} /> Generar reporte
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmarEstado(true)}>
                  {alumno.estado === "activo" ? (
                    <>
                      <UserX className="mr-1.5" size={14} /> Desactivar alumno
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-1.5" size={14} /> Reactivar alumno
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-1 overflow-x-auto rounded-md border bg-muted/40 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Datos del alumno">
              <div className="p-5 pt-1">
                <Campo label="Nombre" value={`${alumno.nombre} ${alumno.apellido}`} />
                <Campo label="DNI" value={formatDni(alumno.dni)} mono />
                <Campo
                  label="Fecha de nacimiento"
                  value={edad !== null ? `${formatFecha(alumno.fechaNacimiento)} · ${edad} años` : formatFecha(alumno.fechaNacimiento)}
                />
                <Campo label="Dirección" value={alumno.direccion} />
                <Campo label="Teléfono" value={alumno.telefono} />
                <Campo label="Email" value={alumno.email} />
                <Campo
                  label="Obs. médicas / alergias"
                  value={alumno.observacionesMedicas ? <span style={{ color: "var(--warning)" }}>{alumno.observacionesMedicas}</span> : "Ninguna registrada"}
                />
                <Campo
                  label="Inscripción"
                  value={
                    antiguedad !== null
                      ? `${formatFecha(alumno.fechaInscripcion)} · ${antiguedad} ${antiguedad === 1 ? "año" : "años"} de antigüedad`
                      : formatFecha(alumno.fechaInscripcion)
                  }
                />
              </div>
            </Panel>

            <Panel title="Datos del padre / tutor">
              <div className="p-5 pt-1">
                <Campo label="Nombre" value={padre && `${padre.nombre} ${padre.apellido}`} />
                <Campo label="DNI" value={padre?.dni && formatDni(padre.dni)} mono />
                <Campo label="Vínculo" value={padre && VINCULO_LABELS[padre.vinculo]} />
                <Campo label="Dirección" value={padre?.direccion} />
                <Campo label="Teléfono" value={padre?.telefono} />
                <Campo label="Email" value={padre?.email} />
                {hermanos.length > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border p-2.5" style={{ background: "var(--brand-soft)", borderColor: "var(--brand-border)" }}>
                    <span className="text-xs" style={{ color: "var(--brand)" }}>
                      Tiene {hermanos.length} hermano{hermanos.length > 1 ? "s" : ""} inscripto{hermanos.length > 1 ? "s" : ""}:{" "}
                      {hermanos.map((h) => h.nombre).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <Panel
            title="Documentación"
            action={<span className="text-[11px] text-muted-foreground">La carga inicial la realiza el padre desde su cuenta</span>}
          >
            <div>
              {ORDEN_DOCUMENTOS.map((tipo, i) => {
                const doc = documentos?.find((d) => d.tipo === tipo);
                const esAutorizacion = tipo === "autorizacion_imagen";
                return (
                  <div
                    key={tipo}
                    className="flex flex-wrap items-center gap-3 px-5 py-3"
                    style={{ borderBottom: i < ORDEN_DOCUMENTOS.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                  >
                    {esAutorizacion ? <FileSignature size={15} className="flex-shrink-0 text-muted-foreground" /> : <FileText size={15} className="flex-shrink-0 text-muted-foreground" />}
                    <div className="min-w-[160px] flex-1">
                      <p className="text-[13px] font-medium">{TIPO_DOCUMENTO_LABELS[tipo]}</p>
                      {esAutorizacion && doc?.estado === "autorizado" ? (
                        <p className="text-[11px]" style={{ color: "var(--brand)" }}>
                          Autorizado el {doc.fechaAutorizacion && formatFecha(doc.fechaAutorizacion)}
                          {doc.tipoAutorizacion === "manual" ? " · firmada en papel" : " · digital"}
                        </p>
                      ) : doc?.fechaCarga ? (
                        <p className="tnum text-[11px] text-muted-foreground">Cargado el {formatFecha(doc.fechaCarga)}</p>
                      ) : null}
                    </div>
                    {esAutorizacion ? (
                      doc?.estado === "autorizado" ? (
                        <>
                          <Badge variant="success">Autorizada</Badge>
                          <Button variant="danger" size="sm" disabled={revocar.isPending} onClick={() => alumnoId && revocar.mutate(alumnoId)}>
                            Revocar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="warning">Pendiente</Badge>
                          <Button variant="outline" size="sm" disabled={marcarManual.isPending} onClick={() => alumnoId && marcarManual.mutate(alumnoId)}>
                            <PenLine className="mr-1.5" size={13} /> Marcar firmada
                          </Button>
                        </>
                      )
                    ) : doc?.estado === "cargado" ? (
                      <>
                        <Badge variant="success">Cargado</Badge>
                        <Button variant="ghost" size="sm" onClick={() => verArchivo(doc)}>
                          <Download size={13} /> Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={marcarCargado.isPending}
                          onClick={() => alumnoId && marcarCargado.mutate({ alumnoId, datos: { tipo: tipo as "formulario_inscripcion" | "copia_dni" } })}
                        >
                          <RefreshCw className="mr-1.5" size={13} /> Reemplazar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="warning">Pendiente</Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={marcarCargado.isPending}
                          onClick={() => alumnoId && marcarCargado.mutate({ alumnoId, datos: { tipo: tipo as "formulario_inscripcion" | "copia_dni" } })}
                        >
                          <Upload className="mr-1.5" size={13} /> Carga manual
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <details className="border-t px-5 py-3" style={{ borderColor: "var(--border-hex)" }}>
              <summary className="cursor-pointer text-[11.5px] font-medium text-muted-foreground">
                Ver texto legal de la autorización de imagen
              </summary>
              <p className="mt-2 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground">
                {TEXTO_LEGAL_AUTORIZACION_IMAGEN}
              </p>
            </details>
          </Panel>
        </div>
      )}

      {tab === "academico" && (
        <div className="space-y-4">
          <div className="flex w-fit items-center gap-1 rounded-md border bg-muted/40 p-1">
            {(Object.keys(PERIODO_LABELS) as PeriodoAcademico[]).map((id) => (
              <button
                key={id}
                onClick={() => setPeriodo(id)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  periodo === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {id === "julio" ? "1° Cierre · Julio" : "2° Cierre · Noviembre"}
              </button>
            ))}
          </div>

          {cargandoNotas ? (
            <p className="text-muted-foreground">Cargando…</p>
          ) : evalsDelPeriodo.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Todavía no hay evaluaciones cargadas para este período.
              </CardContent>
            </Card>
          ) : (
            <Panel
              title={`Evaluaciones · ${PERIODO_LABELS[periodo]}`}
              action={
                <span className="text-[12px] text-muted-foreground">
                  Promedio <span className="tnum font-semibold" style={{ color: "var(--brand)" }}>{promedioPeriodo}</span>
                </span>
              }
            >
              <div>
                {evalsDelPeriodo.map((c, i) => {
                  const notaNum = Number(c.nota);
                  const tone = Number.isNaN(notaNum) ? "var(--text)" : notaNum >= 7 ? "var(--brand)" : notaNum >= 5 ? "var(--warning)" : "var(--danger)";
                  return (
                    <div
                      key={c.id}
                      className="flex items-start gap-3 px-5 py-3.5"
                      style={{ borderBottom: i < evalsDelPeriodo.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                    >
                      <div className="tnum flex h-10 w-10 flex-shrink-0 items-center justify-center rounded font-semibold" style={{ background: "var(--bg-muted)", color: tone, fontSize: 15 }}>
                        {c.nota}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{c.evaluacionNombre}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="tag">{TIPO_EVALUACION_LABELS[c.evaluacionTipo]}</span>
                          <span className="tnum text-[11.5px] text-muted-foreground">{formatFecha(c.evaluacionFecha)}</span>
                        </div>
                        {c.observacion && <p className="mt-1.5 text-[12px] text-muted-foreground">&quot;{c.observacion}&quot;</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {!cargandoNotasCierre && notaCierrePeriodo && (
            <Card style={{ borderColor: "var(--brand-border)", background: notaCierrePeriodo.estado === "publicada" ? "var(--brand-soft)" : "var(--bg-subtle)" }}>
              <CardContent className="flex flex-wrap items-center gap-4 p-5">
                {(() => {
                  const notaNum = Number(notaCierrePeriodo.nota);
                  const tone = Number.isNaN(notaNum) ? "var(--text)" : notaNum >= 7 ? "var(--brand)" : notaNum >= 5 ? "var(--warning)" : "var(--danger)";
                  return (
                    <div className="tnum flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded border font-semibold" style={{ background: "var(--bg)", color: tone, fontSize: 20, borderColor: "var(--border-hex)" }}>
                      {notaCierrePeriodo.nota}
                    </div>
                  );
                })()}
                <div className="min-w-[180px] flex-1">
                  <p className="eyebrow">Nota de cierre — {PERIODO_LABELS[periodo]}</p>
                  <p className="mt-1 text-[13.5px] font-semibold">Nota final del período definida por el profesor</p>
                  {notaCierrePeriodo.observacion && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">&quot;{notaCierrePeriodo.observacion}&quot;</p>}
                </div>
                {notaCierrePeriodo.estado === "publicada" ? (
                  <Badge variant="success">Publicada</Badge>
                ) : (
                  <Badge variant="warning">Borrador — no visible para el padre</Badge>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "asistencia" && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Asistencia</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    onClick={() => cambiarMesAsistencia(-1)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent"
                    title="Mes anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <h3 className="w-[130px] text-center text-[15px] font-semibold">
                    {mesAsistencia ? `${MESES[mesAsistencia.mes - 1]} ${mesAsistencia.anio}` : "—"}
                  </h3>
                  <button
                    onClick={() => cambiarMesAsistencia(1)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent"
                    title="Mes siguiente"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="num-display tnum" style={{ fontSize: 22, color: "var(--brand)" }}>{pctPresencia}%</p>
                <p className="text-[11px] text-muted-foreground">presencia</p>
              </div>
            </div>
            {cargandoAsistencia ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              mesAsistencia && (
                <div className="mx-auto max-w-[300px]">
                  <AttendanceCalendar registros={asistencias ?? []} anio={mesAsistencia.anio} mes={mesAsistencia.mes} />
                </div>
              )
            )}
            <div className="mt-5 grid grid-cols-3 border-t pt-5" style={{ borderColor: "var(--border-hex)" }}>
              {[
                { label: "Presentes", count: presentes, tone: "var(--brand)" },
                { label: "Tardanzas", count: tardanzas, tone: "var(--warning)" },
                { label: "Ausencias", count: ausencias, tone: "var(--danger)" },
              ].map((x, i) => (
                <div key={x.label} style={{ borderLeft: i > 0 ? "1px solid var(--border-hex)" : "none", paddingLeft: i > 0 ? 14 : 0 }}>
                  <p className="eyebrow">{x.label}</p>
                  <p className="num-display tnum mt-1.5" style={{ fontSize: 22, color: x.tone }}>{x.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "cuotas" && (
        <Panel title={`Cuotas${alumno.aplicaDescuentoHermanos ? " · 10% descuento hermano" : ""}`}>
          <div className="p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cargandoCuotas && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      Cargando cuotas…
                    </TableCell>
                  </TableRow>
                )}
                {!cargandoCuotas && cuotas?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                      Este alumno no tiene cuotas cargadas.
                    </TableCell>
                  </TableRow>
                )}
                {cuotas?.map((cuota: Cuota) => (
                  <TableRow key={cuota.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        disabled={cuota.estado === "pagada"}
                        checked={cuotaIdsSeleccionadas.includes(cuota.id)}
                        onChange={() => toggleCuota(cuota.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {MESES[cuota.mes - 1]} {cuota.anio}
                    </TableCell>
                    <TableCell className="tnum text-right text-muted-foreground">{formatMonto(cuota.montoBase)}</TableCell>
                    <TableCell className="tnum text-right" style={{ color: cuota.descuento ? "var(--brand)" : "var(--text-faint)" }}>
                      {cuota.descuento ? `−${formatMonto(cuota.descuento)}` : "—"}
                    </TableCell>
                    <TableCell className="tnum text-right font-semibold">{formatMonto(cuota.montoFinal)}</TableCell>
                    <TableCell className="tnum" style={{ color: cuota.estado === "vencida" ? "var(--danger)" : undefined }}>
                      {formatFecha(cuota.vencimiento)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={CUOTA_VARIANT[cuota.estado]}>{CUOTA_LABELS[cuota.estado]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center gap-3">
              <Select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)} className="w-48">
                {(Object.entries(METODO_PAGO_LABELS) as [MetodoPago, string][]).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </Select>
              <Button type="button" disabled={cuotaIdsSeleccionadas.length === 0 || registrarPago.isPending} onClick={onRegistrarPago}>
                {registrarPago.isPending ? "Registrando..." : `Registrar pago (${cuotaIdsSeleccionadas.length})`}
              </Button>
            </div>

            {registrarPago.isError && (
              <p className="mt-2 text-sm text-destructive">
                {registrarPago.error instanceof ApiError ? registrarPago.error.message : "No se pudo registrar el pago"}
              </p>
            )}
            {registrarPago.isSuccess && <p className="mt-2 text-sm text-emerald-600">Pago registrado correctamente.</p>}
          </div>
        </Panel>
      )}

      {tab === "observaciones" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[{ id: "all", label: "Todas" }, ...Array.from(nombresPorCategoria.entries()).map(([id, label]) => ({ id, label }))].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setObsFiltro(c.id)}
                  className="rounded px-2.5 py-1 text-[12px] font-medium transition-all"
                  style={{
                    border: `1px solid ${obsFiltro === c.id ? "var(--brand)" : "var(--border-hex)"}`,
                    background: obsFiltro === c.id ? "var(--brand-soft)" : "var(--bg)",
                    color: obsFiltro === c.id ? "var(--brand)" : "var(--text-muted)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={abrirModalObs}>
              <Plus className="mr-1.5" size={13} /> Nueva observación
            </Button>
          </div>

          {cargandoObservaciones && <p className="text-muted-foreground">Cargando…</p>}
          {!cargandoObservaciones && observacionesVisibles?.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-[12.5px] text-muted-foreground">Sin observaciones en esta categoría.</CardContent>
            </Card>
          )}
          {observacionesVisibles?.map((observacion) => (
            <Card key={observacion.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="secondary">{nombresPorCategoria.get(observacion.categoria) ?? observacion.categoria}</Badge>
                    <span className="tnum text-[11.5px] text-muted-foreground">{formatFecha(observacion.fecha)}</span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{observacion.texto}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modalObs && (
        <Modal
          title="Nueva observación"
          onClose={() => setModalObs(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setModalObs(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={!obsTexto.trim() || crearObservacion.isPending} onClick={onEnviarObs}>
                <Send className="mr-1.5" size={13} /> Enviar
              </Button>
            </>
          }
        >
          <p className="text-[12px] text-muted-foreground">
            Se enviará al tutor de <strong className="text-foreground">{alumno.nombre} {alumno.apellido}</strong>.
          </p>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(nombresPorCategoria.entries()).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setObsCategoria(id)}
                  className="rounded px-2.5 py-1 text-[12px] font-medium transition-all"
                  style={{
                    border: `1px solid ${obsCategoria === id ? "var(--brand)" : "var(--border-hex)"}`,
                    background: obsCategoria === id ? "var(--brand-soft)" : "var(--bg)",
                    color: obsCategoria === id ? "var(--brand)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observación</Label>
            <textarea
              value={obsTexto}
              onChange={(e) => setObsTexto(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Escribí el mensaje para la familia…"
              className="w-full rounded border p-2.5 text-[13.5px] leading-relaxed"
              style={{ borderColor: "var(--border-hex)", resize: "none" }}
            />
            <p className="tnum text-right text-[11px] text-muted-foreground">{obsTexto.length}/500</p>
          </div>
          {crearObservacion.isError && (
            <p className="text-sm text-destructive">
              {crearObservacion.error instanceof ApiError ? crearObservacion.error.message : "No se pudo enviar la observación"}
            </p>
          )}
        </Modal>
      )}

      {modalEditar && (
        <Modal
          title="Editar datos"
          onClose={() => setModalEditar(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setModalEditar(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={guardandoEdicion} onClick={onGuardarEdicion}>
                {guardandoEdicion ? "Guardando..." : "Guardar cambios"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-[12.5px] font-semibold">Datos del alumno</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input value={formAlumno.nombre} onChange={(e) => setFormAlumno((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input value={formAlumno.apellido} onChange={(e) => setFormAlumno((f) => ({ ...f, apellido: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Dirección</Label>
              <Input value={formAlumno.direccion} onChange={(e) => setFormAlumno((f) => ({ ...f, direccion: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={formAlumno.telefono} onChange={(e) => setFormAlumno((f) => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={formAlumno.email} onChange={(e) => setFormAlumno((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Obs. médicas / alergias</Label>
              <Input
                value={formAlumno.observacionesMedicas}
                onChange={(e) => setFormAlumno((f) => ({ ...f, observacionesMedicas: e.target.value }))}
              />
            </div>
          </div>

          {padre && (
            <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
              <p className="text-[12.5px] font-semibold">Datos del padre / tutor</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input value={formPadre.nombre} onChange={(e) => setFormPadre((f) => ({ ...f, nombre: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido</Label>
                  <Input value={formPadre.apellido} onChange={(e) => setFormPadre((f) => ({ ...f, apellido: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Vínculo</Label>
                <Select value={formPadre.vinculo} onChange={(e) => setFormPadre((f) => ({ ...f, vinculo: e.target.value as VinculoPadre }))}>
                  {(Object.entries(VINCULO_LABELS) as [VinculoPadre, string][]).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dirección</Label>
                <Input value={formPadre.direccion} onChange={(e) => setFormPadre((f) => ({ ...f, direccion: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={formPadre.telefono} onChange={(e) => setFormPadre((f) => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={formPadre.email} onChange={(e) => setFormPadre((f) => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {errorEdicion && (
            <p className="text-sm text-destructive">
              {errorEdicion instanceof ApiError ? errorEdicion.message : "No se pudieron guardar los cambios"}
            </p>
          )}
        </Modal>
      )}

      {confirmarEstado && (
        <Modal
          title={alumno.estado === "activo" ? "Desactivar alumno" : "Reactivar alumno"}
          onClose={() => setConfirmarEstado(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmarEstado(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" className="flex-1" disabled={actualizarAlumno.isPending} onClick={onConfirmarEstado}>
                {actualizarAlumno.isPending ? "Guardando..." : "Confirmar"}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {alumno.estado === "activo"
              ? `¿Confirmás que querés desactivar a ${alumno.nombre} ${alumno.apellido}? Podés reactivarlo en cualquier momento.`
              : `¿Confirmás que querés reactivar a ${alumno.nombre} ${alumno.apellido}?`}
          </p>
        </Modal>
      )}

      {toast && (
        <div className="card-hl fixed bottom-5 right-5 z-50 px-4 py-2.5 text-sm shadow-lg">{toast}</div>
      )}
    </div>
  );
}
