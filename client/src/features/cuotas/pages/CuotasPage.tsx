import { useEffect, useMemo, useState } from "react";
import { DollarSign, Search, X, Check } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { KpiCard } from "@/core/components/ui/kpi-card";
import { Modal } from "@/core/components/ui/modal";
import { ApiError } from "@/core/lib/apiClient";
import { formatDni, formatMonto, normalizarTexto } from "@/core/lib/utils";
import { useAlumnos } from "@/features/alumnos/hooks/useAlumnos";
import type { Alumno } from "@/features/alumnos/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { NIVEL_GRUPO, type Curso } from "@/features/cursos/types";
import { useCuotas } from "../hooks/useCuotas";
import { usePagos } from "../hooks/usePagos";
import { useRegistrarPago } from "../hooks/useRegistrarPago";
import { METODO_PAGO_LABELS, type EstadoCuota, type MetodoPago, type Pago } from "../types";

const ESTADO_VARIANT: Record<EstadoCuota, "success" | "danger"> = {
  pagada: "success",
  vencida: "danger",
};
const ESTADO_LABELS: Record<EstadoCuota, string> = {
  pagada: "Cobrada",
  vencida: "Vencida",
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const METODOS: MetodoPago[] = ["efectivo", "transferencia", "tarjeta"];

type Tab = "vencida" | "pagada" | "todas";

export default function CuotasPage() {
  const { data: alumnos } = useAlumnos();
  const { data: cursos } = useCursos();
  const { data: cuotas } = useCuotas();
  const { data: pagos } = usePagos();
  const registrarPago = useRegistrarPago();

  const [tab, setTab] = useState<Tab>("vencida");
  const [busqueda, setBusqueda] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [payAlumnoId, setPayAlumnoId] = useState<string | null>(null);
  const [payBusqueda, setPayBusqueda] = useState("");
  const [cuotaIdsSeleccionadas, setCuotaIdsSeleccionadas] = useState<string[]>([]);
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const alumnosPorId = useMemo(() => {
    const mapa = new Map<string, Alumno>();
    for (const a of alumnos ?? []) mapa.set(a.id, a);
    return mapa;
  }, [alumnos]);

  const cursosPorId = useMemo(() => {
    const mapa = new Map<string, Curso>();
    for (const c of cursos ?? []) mapa.set(c.id, c);
    return mapa;
  }, [cursos]);

  const pagoPorCuotaId = useMemo(() => {
    const mapa = new Map<string, Pago>();
    for (const p of pagos ?? []) mapa.set(p.cuotaId, p);
    return mapa;
  }, [pagos]);

  const hoy = new Date();
  const cobradoEsteMes = (cuotas ?? []).filter((c) => {
    if (c.estado !== "pagada") return false;
    const pago = pagoPorCuotaId.get(c.id);
    if (!pago) return false;
    const fecha = new Date(pago.fechaPago);
    return fecha.getUTCMonth() === hoy.getUTCMonth() && fecha.getUTCFullYear() === hoy.getUTCFullYear();
  });
  const vencidas = (cuotas ?? []).filter((c) => c.estado === "vencida");
  const pagadas = (cuotas ?? []).filter((c) => c.estado === "pagada");
  const deudaTotal = vencidas.reduce((a, c) => a + c.montoFinal, 0);
  const tasaCobranza = cuotas && cuotas.length > 0 ? Math.round((pagadas.length / cuotas.length) * 100) : 0;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "vencida", label: "Vencidas", count: vencidas.length },
    { id: "pagada", label: "Cobradas", count: pagadas.length },
    { id: "todas", label: "Todas", count: (cuotas ?? []).length },
  ];

  const filtradas = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    return (cuotas ?? []).filter((c) => {
      const matchTab = tab === "todas" || c.estado === tab;
      if (!matchTab) return false;
      if (!termino) return true;
      const a = alumnosPorId.get(c.alumnoId);
      return a ? normalizarTexto(`${a.nombre} ${a.apellido}`).includes(termino) : false;
    });
  }, [cuotas, tab, busqueda, alumnosPorId]);

  const totalTabla = filtradas.reduce((a, c) => a + c.montoFinal, 0);

  const abrirModal = (alumnoId: string | null = null, cuotaId: string | null = null) => {
    setPayBusqueda("");
    setPayAlumnoId(alumnoId);
    setCuotaIdsSeleccionadas(cuotaId ? [cuotaId] : []);
    setMetodo("efectivo");
    setModalOpen(true);
  };

  const resultadosBusquedaAlumno = useMemo(() => {
    const termino = normalizarTexto(payBusqueda.trim());
    if (!termino) return [];
    return (alumnos ?? [])
      .filter((a) => normalizarTexto(`${a.nombre} ${a.apellido} ${a.dni}`).includes(termino))
      .slice(0, 8);
  }, [alumnos, payBusqueda]);

  const cuotasDelAlumnoSeleccionado = useMemo(() => {
    if (!payAlumnoId) return [];
    return (cuotas ?? []).filter((c) => c.alumnoId === payAlumnoId && c.estado !== "pagada");
  }, [cuotas, payAlumnoId]);

  const totalSeleccionado = (cuotas ?? [])
    .filter((c) => cuotaIdsSeleccionadas.includes(c.id))
    .reduce((a, c) => a + c.montoFinal, 0);

  const toggleCuota = (cuotaId: string) => {
    setCuotaIdsSeleccionadas((actual) => (actual.includes(cuotaId) ? actual.filter((id) => id !== cuotaId) : [...actual, cuotaId]));
  };

  const confirmarPago = async () => {
    if (cuotaIdsSeleccionadas.length === 0) return;
    await registrarPago.mutateAsync({ cuotaIds: cuotaIdsSeleccionadas, metodo });
    setModalOpen(false);
    setToast(
      `${cuotaIdsSeleccionadas.length} cuota${cuotaIdsSeleccionadas.length !== 1 ? "s" : ""} registrada${cuotaIdsSeleccionadas.length !== 1 ? "s" : ""} correctamente`,
    );
  };

  const alumnoSeleccionadoModal = payAlumnoId ? alumnosPorId.get(payAlumnoId) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label="Cobrado este mes"
          value={formatMonto(cobradoEsteMes.reduce((a, c) => a + c.montoFinal, 0))}
          sub={`${cobradoEsteMes.length} cuota${cobradoEsteMes.length !== 1 ? "s" : ""}`}
        />
        <KpiCard label="Deuda total" value={formatMonto(deudaTotal)} sub={`${vencidas.length} cuota${vencidas.length !== 1 ? "s" : ""}`} />
        <KpiCard label="Tasa de cobranza" value={`${tasaCobranza}%`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap items-center gap-1 rounded p-1"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)", width: "fit-content" }}
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: tab === t.id ? "var(--bg)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === t.id ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              {t.label} <span className="tnum text-[11px]" style={{ color: "var(--text-faint)" }}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            placeholder="Buscar alumno…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full sm:w-56"
          />
          <Button onClick={() => abrirModal()} className="w-full justify-center sm:w-auto">
            <DollarSign className="mr-1.5" size={14} /> Registrar pago
          </Button>
        </div>
      </div>

      <div className="card-hl hidden overflow-x-auto md:block">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Mes</th>
              <th style={{ textAlign: "right" }}>Monto</th>
              <th>Vencimiento</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No hay cuotas que coincidan.
                </td>
              </tr>
            )}
            {filtradas.map((c) => {
              const alumno = alumnosPorId.get(c.alumnoId);
              const curso = alumno?.cursoId ? cursosPorId.get(alumno.cursoId) : undefined;
              const pago = pagoPorCuotaId.get(c.id);
              if (!alumno) return null;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="xs" />
                      <span className="font-medium">
                        {alumno.nombre} {alumno.apellido}
                      </span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{curso.nombre}</span>}
                  </td>
                  <td>
                    {MESES[c.mes - 1]} {c.anio}
                  </td>
                  <td className="tnum font-medium" style={{ textAlign: "right" }}>
                    {formatMonto(c.montoFinal)}
                  </td>
                  <td className="tnum" style={{ color: "var(--text-muted)" }}>
                    {c.vencimiento.slice(0, 10).split("-").reverse().join("/")}
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABELS[c.estado]}</Badge>
                      {pago && (
                        <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                          {pago.fechaPago.slice(0, 10).split("-").reverse().join("/")} · {METODO_PAGO_LABELS[pago.metodo]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {c.estado !== "pagada" && (
                      <Button variant="outline" size="sm" onClick={() => abrirModal(c.alumnoId, c.id)}>
                        Cobrar
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t px-5 py-3" style={{ borderColor: "var(--border-hex)" }}>
          <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
            {filtradas.length} registro{filtradas.length !== 1 ? "s" : ""}
          </span>
          {tab !== "pagada" && (
            <span className="text-[12.5px] font-medium tnum">Total: {formatMonto(totalTabla)}</span>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="space-y-2.5 md:hidden">
        {filtradas.length === 0 && (
          <p className="card-hl py-10 text-center text-sm text-muted-foreground">No hay cuotas que coincidan.</p>
        )}
        {filtradas.map((c) => {
          const alumno = alumnosPorId.get(c.alumnoId);
          if (!alumno) return null;
          return (
            <div key={c.id} className="card-hl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {MESES[c.mes - 1]} {c.anio}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[14px] font-medium">{formatMonto(c.montoFinal)}</p>
                  <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABELS[c.estado]}</Badge>
                </div>
              </div>
              {c.estado !== "pagada" && (
                <Button className="mt-3 w-full justify-center" onClick={() => abrirModal(c.alumnoId, c.id)}>
                  Registrar pago
                </Button>
              )}
            </div>
          );
        })}
        {filtradas.length > 0 && tab !== "pagada" && (
          <p className="px-1 text-[12.5px] font-medium tnum text-muted-foreground">Total: {formatMonto(totalTabla)}</p>
        )}
      </div>

      {modalOpen && (
        <Modal
          title="Registrar pago"
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={cuotaIdsSeleccionadas.length === 0 || registrarPago.isPending}
                onClick={confirmarPago}
              >
                {registrarPago.isPending
                  ? "Confirmando…"
                  : `Confirmar${cuotaIdsSeleccionadas.length > 0 ? ` (${cuotaIdsSeleccionadas.length})` : ""}`}
              </Button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium">Alumno</label>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={payBusqueda}
                onChange={(e) => {
                  setPayBusqueda(e.target.value);
                  setPayAlumnoId(null);
                  setCuotaIdsSeleccionadas([]);
                }}
                placeholder="Nombre o DNI del alumno…"
                className="pl-7"
              />
            </div>
            {payBusqueda && !payAlumnoId && (
              <div className="overflow-hidden rounded border" style={{ borderColor: "var(--border-hex)" }}>
                {resultadosBusquedaAlumno.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setPayAlumnoId(a.id);
                      setPayBusqueda(`${a.nombre} ${a.apellido}`);
                      setCuotaIdsSeleccionadas([]);
                    }}
                    className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent"
                    style={{ borderColor: "var(--border-hex)" }}
                  >
                    <Avatar name={`${a.nombre} ${a.apellido}`} size="sm" />
                    <div>
                      <p className="text-[13px] font-medium">
                        {a.nombre} {a.apellido}
                      </p>
                      <p className="tnum text-[11px] text-muted-foreground">{formatDni(a.dni)}</p>
                    </div>
                  </button>
                ))}
                {resultadosBusquedaAlumno.length === 0 && (
                  <p className="px-4 py-3 text-[12.5px] text-muted-foreground">Sin resultados</p>
                )}
              </div>
            )}
            {alumnoSeleccionadoModal && (
              <div
                className="flex items-center gap-2 rounded px-3 py-2"
                style={{ background: "var(--brand-soft)", border: "1px solid var(--border-hex)" }}
              >
                <Avatar name={`${alumnoSeleccionadoModal.nombre} ${alumnoSeleccionadoModal.apellido}`} size="sm" tone="brand" />
                <span className="flex-1 text-[13px] font-medium">
                  {alumnoSeleccionadoModal.nombre} {alumnoSeleccionadoModal.apellido}
                </span>
                <button
                  onClick={() => {
                    setPayAlumnoId(null);
                    setPayBusqueda("");
                    setCuotaIdsSeleccionadas([]);
                  }}
                  className="text-muted-foreground"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {payAlumnoId && (
            <div>
              <label className="mb-1.5 block text-[12.5px] font-medium">Cuotas vencidas</label>
              {cuotasDelAlumnoSeleccionado.length === 0 ? (
                <p className="text-[12.5px] text-muted-foreground">Este alumno no tiene cuotas vencidas.</p>
              ) : (
                <div className="space-y-1.5">
                  {cuotasDelAlumnoSeleccionado.map((c) => {
                    const checked = cuotaIdsSeleccionadas.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCuota(c.id)}
                        className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-all"
                        style={{
                          border: `1px solid ${checked ? "var(--brand)" : "var(--border-hex)"}`,
                          background: checked ? "var(--brand-soft)" : "var(--bg)",
                        }}
                      >
                        <div
                          className="flex shrink-0 items-center justify-center rounded-sm"
                          style={{
                            width: 16,
                            height: 16,
                            border: `1px solid ${checked ? "var(--brand)" : "var(--border-strong)"}`,
                            background: checked ? "var(--brand)" : "var(--bg)",
                          }}
                        >
                          {checked && <Check size={11} strokeWidth={2.5} className="text-white" />}
                        </div>
                        <span className="flex-1 text-[13px] font-medium">
                          {MESES[c.mes - 1]} {c.anio}
                        </span>
                        <Badge variant={ESTADO_VARIANT[c.estado]}>{ESTADO_LABELS[c.estado]}</Badge>
                        <span
                          className="tnum text-[13px] font-semibold"
                          style={{ color: checked ? "var(--brand)" : "var(--text)" }}
                        >
                          {formatMonto(c.montoFinal)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {cuotaIdsSeleccionadas.length > 0 && (
            <div
              className="flex items-center justify-between rounded px-4 py-3"
              style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
            >
              <div>
                <p className="eyebrow">Total a cobrar</p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {cuotaIdsSeleccionadas.length} cuota{cuotaIdsSeleccionadas.length !== 1 ? "s" : ""} seleccionada
                  {cuotaIdsSeleccionadas.length !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="num-display tnum" style={{ fontSize: 22, color: "var(--brand)" }}>
                {formatMonto(totalSeleccionado)}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium">Método de pago</label>
            <div className="grid grid-cols-3 gap-1.5">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodo(m)}
                  className="rounded px-3 py-2 text-[12.5px] font-medium transition-all"
                  style={{
                    border: `1px solid ${metodo === m ? "var(--brand)" : "var(--border-hex)"}`,
                    background: metodo === m ? "var(--brand-soft)" : "var(--bg)",
                    color: metodo === m ? "var(--brand)" : "var(--text)",
                  }}
                >
                  {METODO_PAGO_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {registrarPago.isError && (
            <p className="text-sm text-destructive">
              {registrarPago.error instanceof ApiError ? registrarPago.error.message : "No se pudo registrar el pago"}
            </p>
          )}
        </Modal>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-white"
          style={{ background: "var(--text)", borderRadius: 4 }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--brand)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
