import { useEffect, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Interruptor } from "@/core/components/ui/interruptor";
import { ApiError } from "@/core/lib/apiClient";
import { formatFechaHora } from "@/core/lib/utils";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useActualizarAutomatizacion } from "../hooks/useActualizarAutomatizacion";
import type { ReglaConEstado } from "../types";
import { HistorialDeAlertas } from "./HistorialDeAlertas";

// Una regla: interruptor, número editable (con su rango), cuántos alumnos están en alerta ahora, la última revisión y el historial.
export function TarjetaDeRegla({ regla }: { regla: ReglaConEstado }) {
  const actualizar = useActualizarAutomatizacion();
  const [umbral, setUmbral] = useState(String(regla.umbral));
  const [verHistorial, setVerHistorial] = useState(false);
  // Si otra persona (o la propia revisión) cambia el número, el campo se pone al día.
  useEffect(() => setUmbral(String(regla.umbral)), [regla.umbral]);

  const numero = Number(umbral);
  const valido = umbral.trim() !== "" && Number.isInteger(numero) && numero >= regla.umbralMinimo && numero <= regla.umbralMaximo;
  const cambio = umbral !== String(regla.umbral);
  useSinGuardar(cambio);

  const error = actualizar.error instanceof ApiError ? actualizar.error.message : actualizar.isError ? "No se pudo guardar" : null;

  return (
    <div className="rounded-md border" style={{ borderColor: "var(--border-hex)" }} data-regla={regla.id}>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold">{regla.nombre}</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">{regla.descripcion}</p>
          </div>
          <Interruptor
            activo={regla.activa}
            deshabilitado={actualizar.isPending}
            etiqueta={`${regla.activa ? "Apagar" : "Encender"} la regla ${regla.nombre}`}
            onClick={() => actualizar.mutate({ regla: regla.id, cambios: { activa: !regla.activa } })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="label" htmlFor={`umbral-${regla.id}`}>
              Número ({regla.unidad}, de {regla.umbralMinimo} a {regla.umbralMaximo})
            </label>
            <Input id={`umbral-${regla.id}`} type="number" min={regla.umbralMinimo} max={regla.umbralMaximo} value={umbral} onChange={(e) => setUmbral(e.target.value)} className="tnum w-28" />
          </div>
          <Button disabled={!cambio || !valido || actualizar.isPending} onClick={() => actualizar.mutate({ regla: regla.id, cambios: { umbral: numero } })}>
            Guardar
          </Button>
        </div>
        {cambio && !valido && <p className="text-[12px] text-destructive">El número tiene que ser entero y estar entre {regla.umbralMinimo} y {regla.umbralMaximo}.</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
          <span>
            <strong className="tnum text-foreground">{regla.enAlerta}</strong> {regla.enAlerta === 1 ? "alumno en alerta" : "alumnos en alerta"} ahora · Última revisión:{" "}
            {regla.ultimaRevisionEn ? formatFechaHora(regla.ultimaRevisionEn) : "todavía no se revisó"}
          </span>
          <Button variant="outline" size="sm" onClick={() => setVerHistorial(!verHistorial)}>
            {verHistorial ? "Ocultar historial" : "Ver historial"}
          </Button>
        </div>
      </div>
      {verHistorial && (
        <div className="border-t" style={{ borderColor: "var(--border-hex)" }}>
          <HistorialDeAlertas regla={regla.id} />
        </div>
      )}
    </div>
  );
}
