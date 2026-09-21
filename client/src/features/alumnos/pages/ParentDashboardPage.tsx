import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Check, ChevronLeft, ChevronRight, FileSignature, FileText, Upload } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { calcularEdad, formatFecha, formatMonto } from "@/core/lib/utils";
import { NIVEL_GRUPO, type NivelCurso } from "@/features/cursos/types";
import { useCalificacionesDeAlumno } from "@/features/calificaciones/hooks/useCalificacionesDeAlumno";
import { useNotasCierreDeAlumno } from "@/features/calificaciones/hooks/useNotasCierreDeAlumno";
import { PERIODO_LABELS, TIPO_EVALUACION_LABELS } from "@/features/calificaciones/types";
import { AttendanceCalendar } from "@/features/asistencia/components/AttendanceCalendar";
import { useAsistenciaDeAlumno } from "@/features/asistencia/hooks/useAsistenciaDeAlumno";
import { useCuotasPorAlumno } from "@/features/cuotas/hooks/useCuotasPorAlumno";
import type { EstadoCuota } from "@/features/cuotas/types";
import { useAutorizarImagen } from "@/features/documentos/hooks/useAutorizarImagen";
import { useDocumentosPorAlumno } from "@/features/documentos/hooks/useDocumentosPorAlumno";
import { useMarcarCargado } from "@/features/documentos/hooks/useMarcarCargado";
import { TEXTO_LEGAL_AUTORIZACION_IMAGEN } from "@/features/documentos/textoLegalAutorizacion";
import { ORDEN_DOCUMENTOS, TIPO_DOCUMENTO_LABELS } from "@/features/documentos/types";
import { useObservacionesPorAlumno } from "@/features/observaciones/hooks/useObservacionesPorAlumno";
import { CATEGORIA_LABELS, type CategoriaObservacionPredefinida } from "@/features/observaciones/types";
import { useMisHijos } from "../hooks/useMisHijos";

const TABS = [
  { id: "home", label: "Resumen", ruta: "/mis-hijos" },
  { id: "grades", label: "Notas", ruta: "/mis-hijos/calificaciones" },
  { id: "attendance", label: "Asistencia", ruta: "/mis-hijos/asistencia" },
  { id: "fees", label: "Cuotas", ruta: "/mis-hijos/cuotas" },
  { id: "docs", label: "Docs", ruta: "/mis-hijos/documentacion" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CUOTA_VARIANT: Record<EstadoCuota, "success" | "danger"> = {
  pagada: "success",
  vencida: "danger",
};
const CUOTA_LABELS: Record<EstadoCuota, string> = {
  pagada: "Al día",
  vencida: "Vencida",
};

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function tabIdDesdeRuta(pathname: string): TabId {
  const match = TABS.filter((t) => pathname === t.ruta || pathname.startsWith(`${t.ruta}/`)).sort(
    (a, b) => b.ruta.length - a.ruta.length,
  )[0];
  return match?.id ?? "home";
}

export default function ParentDashboardPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tab = tabIdDesdeRuta(pathname);
  const { data: hijos } = useMisHijos();
  const [kidIdx, setKidIdx] = useState(0);

  const kid = hijos?.[kidIdx];

  const { data: calificaciones } = useCalificacionesDeAlumno(kid?.id);
  const { data: notasCierre } = useNotasCierreDeAlumno(kid?.id);
  const { data: asistencia } = useAsistenciaDeAlumno(kid?.id);
  const { data: cuotas } = useCuotasPorAlumno(kid?.id ?? null);
  const { data: documentos } = useDocumentosPorAlumno(kid?.id);
  const { data: observaciones } = useObservacionesPorAlumno(kid?.id);
  const marcarCargado = useMarcarCargado();
  const autorizarImagen = useAutorizarImagen();

  const [toast, setToast] = useState("");
  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    setTimeout(() => setToast(""), 2600);
  };

  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  useEffect(() => {
    setAceptaTerminos(false);
  }, [kid?.id]);

  const edad = kid ? calcularEdad(kid.fechaNacimiento) : null;

  const promedio = useMemo(() => {
    if (!calificaciones || calificaciones.length === 0) return null;
    const notas = calificaciones.map((c) => Number.parseFloat(c.nota)).filter((n) => !Number.isNaN(n));
    if (notas.length === 0) return null;
    return (notas.reduce((a, n) => a + n, 0) / notas.length).toFixed(1);
  }, [calificaciones]);

  const presentes = asistencia?.filter((a) => a.estado === "presente").length ?? 0;
  const tardanzas = asistencia?.filter((a) => a.estado === "tarde").length ?? 0;
  const totalMarcado = asistencia?.length ?? 0;
  const asistenciaPct = totalMarcado > 0 ? Math.round(((presentes + tardanzas) / totalMarcado) * 100) : null;

  // Calendario de asistencia navegable por mes — mismo patrón que el legajo de Admin.
  const mesesConRegistros = useMemo(() => {
    const mapa = new Map<string, { anio: number; mes: number }>();
    for (const a of asistencia ?? []) {
      const [anio, mes] = a.fecha.slice(0, 10).split("-").map(Number);
      mapa.set(`${anio}-${mes}`, { anio, mes });
    }
    return Array.from(mapa.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  }, [asistencia]);
  const [mesAsistencia, setMesAsistencia] = useState<{ anio: number; mes: number } | null>(null);
  useEffect(() => {
    setMesAsistencia(null);
  }, [kid?.id]);
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
    return (asistencia ?? []).filter((a) => {
      const [anio, mes] = a.fecha.slice(0, 10).split("-").map(Number);
      return anio === mesAsistencia.anio && mes === mesAsistencia.mes;
    });
  }, [asistencia, mesAsistencia]);
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
  const presentesMes = registrosDelMes.filter((a) => a.estado === "presente").length;
  const tardanzasMes = registrosDelMes.filter((a) => a.estado === "tarde").length;
  const ausenciasMes = registrosDelMes.filter((a) => a.estado === "ausente").length;
  const pctPresenciaMes = registrosDelMes.length > 0 ? Math.round((presentesMes / registrosDelMes.length) * 100) : 0;

  const cuotaActual = useMemo(() => {
    if (!cuotas || cuotas.length === 0) return null;
    return cuotas.slice().sort((a, b) => b.anio - a.anio || b.mes - a.mes)[0];
  }, [cuotas]);

  const cierreVisible = notasCierre?.find((n) => n.estado === "publicada" && n.periodo === "julio") ?? null;

  const autorizacion = documentos?.find((d) => d.tipo === "autorizacion_imagen");
  const autorizacionAlDia = autorizacion?.estado === "autorizado";
  const documentosPendientesCount = documentos
    ? ORDEN_DOCUMENTOS.filter((tipo) => {
        const doc = documentos.find((d) => d.tipo === tipo);
        return tipo === "autorizacion_imagen" ? doc?.estado !== "autorizado" : doc?.estado !== "cargado";
      }).length
    : 0;
  const documentacionPendiente = documentos !== undefined && documentosPendientesCount > 0;

  const onAutorizarImagen = () => {
    if (!kid) return;
    autorizarImagen.mutate(
      { alumnoId: kid.id },
      { onSuccess: () => mostrarToast("Autorización registrada correctamente") },
    );
  };

  const onSubirArchivo = (tipo: "formulario_inscripcion" | "copia_dni") => {
    if (!kid) return;
    marcarCargado.mutate(
      { alumnoId: kid.id, datos: { tipo } },
      { onSuccess: () => mostrarToast("Archivo cargado correctamente") },
    );
  };

  if (!hijos) {
    return <p className="text-muted-foreground">Cargando…</p>;
  }
  if (hijos.length === 0) {
    return <p className="text-muted-foreground">No hay alumnos asociados a tu cuenta.</p>;
  }
  if (!kid) return null;

  return (
    <div className="space-y-4">
      {hijos.length > 1 && (
        <div
          className="flex items-center gap-1 rounded p-1"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
        >
          {hijos.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setKidIdx(i)}
              className="flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-[12.5px] font-medium transition-all"
              style={{
                background: i === kidIdx ? "var(--bg)" : "transparent",
                color: i === kidIdx ? "var(--text)" : "var(--text-muted)",
                boxShadow: i === kidIdx ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              <Avatar name={`${h.nombre} ${h.apellido}`} size="sm" tone={i === kidIdx ? "brand" : "neutral"} />
              <span className="truncate">{h.nombre}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card-hl p-5">
        <div className="flex items-start gap-4">
          <Avatar name={`${kid.nombre} ${kid.apellido}`} size="lg" tone="brand" />
          <div className="min-w-0 flex-1">
            {kid.cursoNivel && (
              <div className="mb-1.5">
                <span className={`level-pill ${NIVEL_GRUPO[kid.cursoNivel as NivelCurso]}`}>{kid.cursoNombre}</span>
              </div>
            )}
            <h2 className="text-[18px] font-semibold leading-tight tracking-tight">
              {kid.nombre} {kid.apellido}
            </h2>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {kid.profesorNombre && `Prof. ${kid.profesorNombre}`}
              {kid.profesorNombre && edad !== null && " · "}
              {edad !== null && `${edad} años`}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 border-t pt-5" style={{ borderColor: "var(--border-hex)" }}>
          <div>
            <p className="eyebrow">Promedio</p>
            <p className="num-display tnum mt-1.5" style={{ fontSize: 22 }}>
              {promedio ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">/ 10</p>
          </div>
          <div className="border-l pl-3.5" style={{ borderColor: "var(--border-hex)" }}>
            <p className="eyebrow">Asistencia</p>
            <p className="num-display tnum mt-1.5" style={{ fontSize: 22 }}>
              {asistenciaPct !== null ? `${asistenciaPct}%` : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {presentes + tardanzas}/{totalMarcado} clases
            </p>
          </div>
          <div className="border-l pl-3.5" style={{ borderColor: "var(--border-hex)" }}>
            <p className="eyebrow">Cuota actual</p>
            <p
              className="num-display tnum mt-1.5"
              style={{
                fontSize: 22,
                color: cuotaActual ? (cuotaActual.estado === "pagada" ? "var(--brand)" : "var(--danger)") : "var(--text)",
              }}
            >
              {cuotaActual ? CUOTA_LABELS[cuotaActual.estado] : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">estado</p>
          </div>
        </div>
      </div>

      <div
        className="flex items-center gap-1 rounded p-1"
        style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => navigate(t.ruta)}
            className="flex flex-1 items-center justify-center rounded py-2 text-[12.5px] font-medium transition-all"
            style={{
              background: tab === t.id ? "var(--bg)" : "transparent",
              color: tab === t.id ? "var(--text)" : "var(--text-muted)",
              boxShadow: tab === t.id ? "0 0 0 1px var(--border-hex)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "home" && (
        <div className="space-y-4">
          {documentacionPendiente && (
            <div
              className="flex items-center gap-3 rounded px-4 py-3"
              style={{ borderColor: "var(--warning-dot)", background: "var(--warning-soft)", border: "1px solid var(--warning-dot)" }}
            >
              <AlertCircle size={15} className="flex-shrink-0" style={{ color: "var(--warning)" }} />
              <p className="flex-1 text-[12.5px]" style={{ color: "var(--warning)" }}>
                Tenés documentación pendiente de <strong>{kid.nombre}</strong>.
              </p>
              <Button size="sm" onClick={() => navigate("/mis-hijos/documentacion")}>
                Completar
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {observaciones && observaciones.length > 0 && (
              <div className="card-hl p-5">
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-[13px] font-semibold tracking-tight">Mensajes del instituto</h3>
                  <span className="text-[11px] text-muted-foreground">{formatFecha(observaciones[0].fecha)}</span>
                </div>
                <div className="space-y-2.5">
                  {observaciones.slice(0, 2).map((o) => (
                    <div
                      key={o.id}
                      className="rounded px-4 py-3"
                      style={{ background: "var(--brand-soft)", border: "1px solid var(--brand-border)" }}
                    >
                      <span
                        className="mb-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium"
                        style={{ border: "1px solid var(--brand)", color: "var(--brand)" }}
                      >
                        {CATEGORIA_LABELS[o.categoria as CategoriaObservacionPredefinida] ?? "Nota"}
                      </span>
                      <p className="text-[13px] leading-relaxed">{o.texto}</p>
                      <p className="mt-2 text-[11.5px] text-muted-foreground">— {o.emisorNombre}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Panel title="Últimas calificaciones">
              {(!calificaciones || calificaciones.length === 0) && (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">Todavía no hay notas publicadas.</p>
              )}
              {calificaciones?.slice(-3).reverse().map((c, i, arr) => {
                const nota = Number.parseFloat(c.nota);
                const tone = Number.isNaN(nota) ? "var(--text)" : nota >= 7 ? "var(--brand)" : nota >= 5 ? "var(--warning)" : "var(--danger)";
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                  >
                    <div
                      className="flex flex-shrink-0 items-center justify-center rounded font-semibold tnum"
                      style={{ width: 36, height: 36, background: "var(--bg-muted)", color: tone, fontSize: 14 }}
                    >
                      {c.nota}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{c.evaluacionNombre}</p>
                      <p className="text-[11.5px] text-muted-foreground">
                        {TIPO_EVALUACION_LABELS[c.evaluacionTipo]} · {formatFecha(c.evaluacionFecha)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </Panel>
          </div>
        </div>
      )}

      {tab === "grades" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_340px]">
          <Panel
            title="Calificaciones"
            action={
              <span className="text-[12px] text-muted-foreground">
                Promedio: <span className="tnum font-medium" style={{ color: "var(--brand)" }}>{promedio ?? "—"}</span>
              </span>
            }
          >
            {(!calificaciones || calificaciones.length === 0) && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">Todavía no hay notas publicadas.</p>
            )}
            {calificaciones?.map((c, i, arr) => {
              const nota = Number.parseFloat(c.nota);
              const tone = Number.isNaN(nota) ? "var(--text)" : nota >= 7 ? "var(--brand)" : nota >= 5 ? "var(--warning)" : "var(--danger)";
              return (
                <div key={c.id} className="px-5 py-4" style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="flex flex-shrink-0 items-center justify-center rounded font-semibold tnum"
                      style={{ width: 44, height: 44, background: "var(--bg-muted)", color: tone, fontSize: 17 }}
                    >
                      {c.nota}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{c.evaluacionNombre}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="tag">{TIPO_EVALUACION_LABELS[c.evaluacionTipo]}</span>
                        <span className="tnum text-[11.5px] text-muted-foreground">{formatFecha(c.evaluacionFecha)}</span>
                      </div>
                      {c.observacion && <p className="mt-2 text-[12px] text-muted-foreground">"{c.observacion}"</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </Panel>

          {cierreVisible && (
            <div className="card-hl p-5" style={{ borderColor: "var(--border-hex)", background: "var(--brand-soft)" }}>
              <div className="flex items-center gap-4">
                <div
                  className="flex flex-shrink-0 items-center justify-center rounded font-semibold tnum"
                  style={{ width: 52, height: 52, background: "var(--bg)", color: "var(--brand)", fontSize: 20, border: "1px solid var(--border-hex)" }}
                >
                  {cierreVisible.nota}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="eyebrow" style={{ color: "var(--brand)" }}>
                    Nota de cierre — {PERIODO_LABELS[cierreVisible.periodo]}
                  </p>
                  <p className="mt-1 text-[13.5px] font-semibold" style={{ color: "var(--brand)" }}>
                    Nota final del período: {cierreVisible.nota} / 10
                  </p>
                  {cierreVisible.observacion && (
                    <p className="mt-1.5 text-[12px] text-muted-foreground">"{cierreVisible.observacion}"</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "attendance" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[420px_1fr]">
          <div className="card-hl p-5">
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
                <p className="num-display tnum" style={{ fontSize: 22, color: "var(--brand)" }}>
                  {pctPresenciaMes}%
                </p>
                <p className="text-[11px] text-muted-foreground">presencia</p>
              </div>
            </div>
            {mesAsistencia && (
              <div className="mx-auto max-w-[300px]">
                <AttendanceCalendar registros={asistencia ?? []} anio={mesAsistencia.anio} mes={mesAsistencia.mes} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="card-hl p-4">
                <p className="eyebrow">Presentes</p>
                <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: "var(--brand)" }}>
                  {presentesMes}
                </p>
              </div>
              <div className="card-hl p-4">
                <p className="eyebrow">Tardanzas</p>
                <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: "var(--warning)" }}>
                  {tardanzasMes}
                </p>
              </div>
              <div className="card-hl p-4">
                <p className="eyebrow">Ausencias</p>
                <p className="num-display tnum mt-1.5" style={{ fontSize: 24, color: "var(--danger)" }}>
                  {ausenciasMes}
                </p>
              </div>
            </div>
            <Panel title="Detalle del mes">
              {registrosDelMes.length === 0 && (
                <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay registros de asistencia para este mes.
                </p>
              )}
              {registrosDelMes
                .slice()
                .sort((a, b) => b.fecha.localeCompare(a.fecha))
                .map((a, i, arr) => {
                  const [anio, mes, dia] = a.fecha.slice(0, 10).split("-");
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                    >
                      <span className="text-[13px]">
                        {Number(dia)} de {MESES[Number(mes) - 1]} de {anio}
                      </span>
                      <div className="flex items-center gap-2">
                        {a.estado === "tarde" && a.minutosRetraso !== undefined && (
                          <span className="text-[11.5px] text-muted-foreground">{a.minutosRetraso} min.</span>
                        )}
                        <Badge variant={a.estado === "presente" ? "success" : a.estado === "tarde" ? "warning" : "danger"}>
                          {a.estado === "presente" ? "Presente" : a.estado === "tarde" ? "Tarde" : "Ausente"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </Panel>
          </div>
        </div>
      )}

      {tab === "fees" && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(!cuotas || cuotas.length === 0) && <p className="text-sm text-muted-foreground">Todavía no hay cuotas cargadas.</p>}
          {cuotas?.map((c) => (
            <div key={c.id} className="card-hl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium capitalize">
                    {MESES[c.mes - 1]} {c.anio}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">Vence: {formatFecha(c.vencimiento)}</p>
                  {c.fechaPago && <p className="mt-0.5 text-[11.5px]">Pagada el {formatFecha(c.fechaPago)}</p>}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="tnum text-[14px] font-medium">{formatMonto(c.montoFinal)}</p>
                  <div className="mt-1">
                    <Badge variant={CUOTA_VARIANT[c.estado]}>{CUOTA_LABELS[c.estado]}</Badge>
                  </div>
                </div>
              </div>
              {c.estado !== "pagada" && (
                <p
                  className="mt-3 flex items-start gap-2 border-t pt-3 text-[11.5px] text-muted-foreground"
                  style={{ borderColor: "var(--border-hex)" }}
                >
                  El pago se realiza directamente en el instituto (efectivo, transferencia o tarjeta).
                </p>
              )}
            </div>
          ))}
          {kid.aplicaDescuentoHermanos && (
            <div className="card-hl p-3 md:col-span-2" style={{ background: "var(--brand-soft)", borderColor: "var(--border-hex)" }}>
              <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--brand)" }}>
                Descuento del 10% aplicado por hermano inscripto.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "docs" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ORDEN_DOCUMENTOS.map((tipo) => {
              const doc = documentos?.find((d) => d.tipo === tipo);
              const esAutorizacion = tipo === "autorizacion_imagen";
              const completo = esAutorizacion ? doc?.estado === "autorizado" : doc?.estado === "cargado";
              return (
                <div key={tipo} className="card-hl p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex flex-shrink-0 items-center justify-center rounded"
                      style={{
                        width: 34,
                        height: 34,
                        background: completo ? "var(--brand-soft)" : "var(--bg-muted)",
                        color: completo ? "var(--brand)" : "var(--text-faint)",
                      }}
                    >
                      {esAutorizacion ? <FileSignature size={15} /> : <FileText size={15} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{TIPO_DOCUMENTO_LABELS[tipo]}</p>
                      {esAutorizacion && doc?.estado === "autorizado" ? (
                        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--brand)" }}>
                          Autorizada el {doc.fechaAutorizacion && formatFecha(doc.fechaAutorizacion)}
                          {doc.tipoAutorizacion === "manual" && " (firmada en papel)"}
                        </p>
                      ) : doc?.fechaCarga ? (
                        <p className="mt-0.5 text-[11.5px] text-muted-foreground">Cargado el {formatFecha(doc.fechaCarga)}</p>
                      ) : (
                        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--warning)" }}>
                          Pendiente
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {esAutorizacion ? (
                        doc?.estado === "autorizado" ? (
                          <Badge variant="success">Autorizada</Badge>
                        ) : (
                          <Badge variant="warning">Pendiente</Badge>
                        )
                      ) : doc?.estado === "cargado" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!doc?.urlArchivo) {
                              mostrarToast("No hay ningún archivo cargado todavía");
                              return;
                            }
                            window.open(doc.urlArchivo, "_blank");
                          }}
                        >
                          Ver
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={marcarCargado.isPending}
                          onClick={() => onSubirArchivo(tipo as "formulario_inscripcion" | "copia_dni")}
                        >
                          <Upload className="mr-1.5" size={12} /> Subir archivo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!autorizacionAlDia && (
            <div className="card-hl p-5">
              <p className="eyebrow mb-1">Autorización digital</p>
              <h3 className="text-[15px] font-semibold tracking-tight">
                Autorización de imagen — {kid.nombre} {kid.apellido}
              </h3>
              <div
                className="mt-3 max-h-[280px] overflow-y-auto rounded p-4 text-[12px] leading-relaxed text-muted-foreground"
                style={{ background: "var(--bg-subtle)", whiteSpace: "pre-line" }}
              >
                {TEXTO_LEGAL_AUTORIZACION_IMAGEN}
              </div>
              <label className="mt-4 flex cursor-pointer select-none items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => setAceptaTerminos((v) => !v)}
                  className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded"
                  style={{
                    background: aceptaTerminos ? "var(--brand)" : "var(--bg)",
                    border: `1px solid ${aceptaTerminos ? "var(--brand)" : "var(--border-strong)"}`,
                  }}
                >
                  {aceptaTerminos && <Check size={11} strokeWidth={2.5} color="#fff" />}
                </button>
                <span className="text-[12.5px] leading-snug">
                  He leído y acepto la autorización de imagen para{" "}
                  <strong>
                    {kid.nombre} {kid.apellido}
                  </strong>
                </span>
              </label>
              <Button
                className="mt-3 w-full justify-center"
                disabled={!aceptaTerminos || autorizarImagen.isPending}
                onClick={onAutorizarImagen}
              >
                {autorizarImagen.isPending ? "Guardando…" : "Autorizar"}
              </Button>
              {autorizarImagen.isError && (
                <p className="mt-3 text-sm text-destructive">
                  {autorizarImagen.error instanceof ApiError ? autorizarImagen.error.message : "No se pudo registrar la autorización"}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Se registrará tu nombre, fecha y hora de aceptación. Una vez autorizada, solo la administración del
                instituto puede modificarla.
              </p>
            </div>
          )}

          <p className="px-1 text-[11.5px] leading-relaxed text-muted-foreground">
            Los documentos ya cargados solo pueden ser reemplazados por la administración del instituto. Si necesitás
            corregir un archivo, comunicate con secretaría.
          </p>
        </div>
      )}

      {toast && <div className="card-hl fixed bottom-5 right-5 z-50 px-4 py-2.5 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}
