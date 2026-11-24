import { useEffect, useMemo, useState } from "react";
import { AvisoDeCambioAjeno } from "@/core/formularios/AvisoDeCambioAjeno";
import { useFormularioAlDia } from "@/core/formularios/useFormularioAlDia";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { Link } from "react-router-dom";
import { Moon, Plus, Sun } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { useThemeStore } from "@/core/store/themeStore";
import { formatMonto } from "@/core/lib/utils";
import { useActualizarConfiguracion } from "@/features/configuracion/hooks/useActualizarConfiguracion";
import { useConfiguracion } from "@/features/configuracion/hooks/useConfiguracion";
import { PanelAutomatizaciones } from "@/features/automatizaciones/components/PanelAutomatizaciones";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useBloquearCiclo } from "@/features/ciclos/hooks/useBloquearCiclo";
import { useCrearCiclo } from "@/features/ciclos/hooks/useCrearCiclo";
import { useDesbloquearCiclo } from "@/features/ciclos/hooks/useDesbloquearCiclo";
import type { Ciclo } from "@/features/ciclos/types";
import { useMarcarCicloActivo } from "@/features/ciclos/hooks/useMarcarCicloActivo";

export default function ConfiguracionPage() {
  const { data: ciclos, isLoading } = useCiclos();
  const crearCiclo = useCrearCiclo();
  const marcarActivo = useMarcarCicloActivo();
  const bloquearCiclo = useBloquearCiclo();
  const desbloquearCiclo = useDesbloquearCiclo();
  const [confirmando, setConfirmando] = useState<{ accion: "bloquear" | "desbloquear"; ciclo: Ciclo } | null>(null);
  const [nuevoAnio, setNuevoAnio] = useState("");
  const { tema, alternarTema } = useThemeStore();
  const { data: configuracion } = useConfiguracion();
  const actualizarConfiguracion = useActualizarConfiguracion();
  const [valorCuota, setValorCuota] = useState("");
  const [cuotaGuardada, setCuotaGuardada] = useState(false);

  const valorGuardado = configuracion?.valorCuota != null ? String(configuracion.valorCuota) : "";
  // El campo muestra el valor guardado apenas se carga; después, si otra persona lo cambia, se pone al día solo mientras no
  // se lo haya tocado (lo que se está escribiendo nunca se pisa) y un aviso dice quién lo cambió.
  const [cargado, setCargado] = useState(false);
  useEffect(() => {
    if (configuracion && !cargado) {
      setValorCuota(valorGuardado);
      setCargado(true);
    }
  }, [configuracion, cargado, valorGuardado]);
  const servidor = useMemo(() => (configuracion ? { valorCuota: valorGuardado } : undefined), [configuracion, valorGuardado]);
  const alDia = useFormularioAlDia<{ valorCuota: string }>({
    activo: cargado,
    dato: "configuracion",
    claveDeId: "",
    id: "",
    servidor,
    etiquetas: { valorCuota: "el valor de la cuota" },
    valores: { valorCuota },
    aplicar: (parcial) => setValorCuota(parcial.valorCuota ?? ""),
  });

  useSinGuardar(valorCuota !== valorGuardado || nuevoAnio.trim() !== "");

  const valorNumerico = Number(valorCuota);
  const valorValido = valorCuota.trim() !== "" && Number.isFinite(valorNumerico) && valorNumerico > 0;
  const onGuardarCuota = () => {
    if (!valorValido) return;
    setCuotaGuardada(false);
    actualizarConfiguracion.mutate({ valorCuota: valorNumerico }, { onSuccess: () => setCuotaGuardada(true) });
  };

  const onCrear = () => {
    const anio = Number(nuevoAnio);
    if (!Number.isInteger(anio) || anio < 2000) return;
    crearCiclo.mutate({ anio }, { onSuccess: () => setNuevoAnio("") });
  };

  return (
    <div className="space-y-4">
      <Panel title="Apariencia">
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-muted-foreground">
            Elegí cómo se ve el sistema en este dispositivo. La preferencia se guarda en el navegador.
          </p>
          <div className="flex items-center gap-2">
            {(
              [
                { valor: "light" as const, label: "Claro", icon: Sun },
                { valor: "dark" as const, label: "Oscuro", icon: Moon },
              ]
            ).map(({ valor, label, icon: Icon }) => (
              <button
                key={valor}
                onClick={() => {
                  if (tema !== valor) alternarTema();
                }}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
                style={{
                  background: tema === valor ? "var(--brand)" : "var(--bg)",
                  color: tema === valor ? "#fff" : "var(--text)",
                  border: `1px solid ${tema === valor ? "var(--brand)" : "var(--border-hex)"}`,
                }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Cuota mensual">
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-muted-foreground">
            Es el mismo valor para todos los cursos. El sistema genera solo la cuota de cada mes (de marzo a noviembre)
            para los alumnos activos del ciclo activo; vence el día 10 y lleva el 10% de descuento a partir del segundo
            hermano. Un cambio de valor rige para las cuotas que se generen desde ahora: las ya generadas conservan su
            monto.
          </p>
          {configuracion && configuracion.valorCuota === null && (
            <p className="rounded-md border p-3 text-[12.5px]" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)", color: "var(--warning)" }}>
              Todavía no hay un valor cargado: mientras tanto no se generan cuotas.
            </p>
          )}
          <AvisoDeCambioAjeno aviso={alDia.aviso} onCerrar={alDia.descartarAviso} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">$</span>
              <Input
                type="number"
                min={1}
                step={100}
                value={valorCuota}
                onChange={(e) => {
                  setValorCuota(e.target.value);
                  setCuotaGuardada(false);
                }}
                placeholder="35000"
                className={`tnum w-44 pl-7 ${alDia.resaltados.has("valorCuota") ? "cambio-resaltado" : ""}`}
              />
            </div>
            <Button onClick={onGuardarCuota} disabled={!valorValido || actualizarConfiguracion.isPending}>
              {actualizarConfiguracion.isPending ? "Guardando…" : "Guardar"}
            </Button>
            {cuotaGuardada && configuracion?.valorCuota != null && (
              <span className="text-[12.5px]" style={{ color: "var(--brand)" }}>
                Guardado: {formatMonto(configuracion.valorCuota)} por mes
              </span>
            )}
          </div>
          {actualizarConfiguracion.isError && (
            <p className="text-sm text-destructive">
              {actualizarConfiguracion.error instanceof ApiError ? actualizarConfiguracion.error.message : "No se pudo guardar el valor"}
            </p>
          )}
        </div>
      </Panel>

      <Panel
        title="Ciclos lectivos"
        action={
          <Link to="/ciclos/pasar-de-anio">
            <Button variant="outline" size="sm">
              Pasar de año
            </Button>
          </Link>
        }
      >
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-muted-foreground">
            El ciclo activo es el que se asigna por defecto a los cursos y alumnos que se dan de alta hoy. Los ciclos
            anteriores quedan como historial. Un ciclo terminado se puede bloquear: queda tal como está y nadie puede cambiar
            sus cursos, inscripciones, asistencia ni notas (se pueden seguir cobrando sus cuotas).
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {ciclos?.map((ciclo) => (
            <div key={ciclo.id} className="flex items-center justify-between gap-3 rounded-md border p-3" style={{ borderColor: "var(--border-hex)" }}>
              <div className="flex items-center gap-2.5">
                <span className="tnum text-[15px] font-semibold">{ciclo.anio}</span>
                {ciclo.activo ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="neutral">Histórico</Badge>
                )}
                {ciclo.bloqueado && <Badge variant="warning">Bloqueado</Badge>}
              </div>
              <div className="flex items-center gap-2">
                {!ciclo.activo && !ciclo.bloqueado && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmando({ accion: "bloquear", ciclo })}>
                    Bloquear
                  </Button>
                )}
                {ciclo.bloqueado && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmando({ accion: "desbloquear", ciclo })}>
                    Desbloquear
                  </Button>
                )}
                {!ciclo.activo && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={marcarActivo.isPending || ciclo.bloqueado}
                    title={ciclo.bloqueado ? "Desbloqueá el ciclo para poder activarlo" : undefined}
                    onClick={() => marcarActivo.mutate(ciclo.id)}
                  >
                    Marcar como activo
                  </Button>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-end gap-2 border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
            <div className="flex-1 space-y-1.5">
              <label className="label">Nuevo ciclo (año)</label>
              <Input
                type="number"
                value={nuevoAnio}
                onChange={(e) => setNuevoAnio(e.target.value)}
                placeholder="Ej: 2027"
              />
            </div>
            <Button onClick={onCrear} disabled={crearCiclo.isPending || !nuevoAnio}>
              <Plus className="mr-1.5" size={14} /> Crear
            </Button>
          </div>
          {crearCiclo.isError && (
            <p className="text-sm text-destructive">
              {crearCiclo.error instanceof ApiError ? crearCiclo.error.message : "No se pudo crear el ciclo"}
            </p>
          )}
          {marcarActivo.isError && (
            <p className="text-sm text-destructive">
              {marcarActivo.error instanceof ApiError ? marcarActivo.error.message : "No se pudo activar el ciclo"}
            </p>
          )}
        </div>
      </Panel>

      <PanelAutomatizaciones />

      {confirmando && (
        <Modal
          title={confirmando.accion === "bloquear" ? `Bloquear el ciclo ${confirmando.ciclo.anio}` : `Desbloquear el ciclo ${confirmando.ciclo.anio}`}
          onClose={() => setConfirmando(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmando(null)}>
                Cancelar
              </Button>
              <Button
                disabled={bloquearCiclo.isPending || desbloquearCiclo.isPending}
                onClick={() => {
                  const mutacion = confirmando.accion === "bloquear" ? bloquearCiclo : desbloquearCiclo;
                  mutacion.mutate(confirmando.ciclo.id, { onSuccess: () => setConfirmando(null) });
                }}
              >
                {confirmando.accion === "bloquear" ? "Bloquear" : "Desbloquear"}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {confirmando.accion === "bloquear"
              ? `Con el ciclo ${confirmando.ciclo.anio} bloqueado nadie puede cambiar sus cursos, inscripciones, asistencia ni notas, y los registros quedan tal como están. Se pueden seguir cobrando las cuotas pendientes o vencidas. Podés desbloquearlo cuando quieras.`
              : `Con el ciclo ${confirmando.ciclo.anio} desbloqueado se vuelven a poder cambiar sus cursos, inscripciones, asistencia y notas.`}
          </p>
          {(bloquearCiclo.isError || desbloquearCiclo.isError) && (
            <p className="text-sm text-destructive">
              {[bloquearCiclo.error, desbloquearCiclo.error].find((e) => e instanceof ApiError)?.message ?? "No se pudo cambiar el estado del ciclo"}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
