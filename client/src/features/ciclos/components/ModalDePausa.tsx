import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { calendarioDelCiclo, validarPausa } from "../calendario";
import { useGuardarPausa } from "../hooks/useGuardarPausa";
import { TIPOS_DE_PAUSA } from "../tiposDePausa";
import type { Ciclo, PausaDelCiclo, TipoDePausa } from "../types";

// Alta o edición de una pausa (días sin clases) de un ciclo. Un feriado es de un solo día: no pide "hasta".
export function ModalDePausa({ ciclo, pausa, onClose }: { ciclo: Ciclo; pausa?: PausaDelCiclo; onClose: () => void }) {
  const guardar = useGuardarPausa();
  const inicial = {
    nombre: pausa?.nombre ?? "",
    tipo: pausa?.tipo ?? ("feriado" as TipoDePausa),
    desde: pausa?.desde.slice(0, 10) ?? "",
    hasta: pausa?.hasta.slice(0, 10) ?? "",
  };
  const [nombre, setNombre] = useState(inicial.nombre);
  const [tipo, setTipo] = useState<TipoDePausa>(inicial.tipo);
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);

  const hastaEfectivo = tipo === "feriado" ? desde : hasta;
  const sinGuardar = nombre !== inicial.nombre || tipo !== inicial.tipo || desde !== inicial.desde || hasta !== inicial.hasta;
  const completo = nombre.trim() !== "" && desde !== "" && hastaEfectivo !== "";
  const otras = calendarioDelCiclo(ciclo).pausas.filter((_, i) => ciclo.pausas[i].id !== pausa?.id);
  const error = completo ? validarPausa(calendarioDelCiclo(ciclo), { desde, hasta: hastaEfectivo, nombre }, otras) : null;

  const onGuardar = () => {
    if (!completo || error) return;
    guardar.mutate({ cicloId: ciclo.id, pausaId: pausa?.id, datos: { desde, hasta: hastaEfectivo, nombre: nombre.trim(), tipo } }, { onSuccess: onClose });
  };

  return (
    <Modal
      title={pausa ? "Editar pausa" : "Agregar pausa"}
      onClose={onClose}
      sinGuardar={sinGuardar}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={!completo || !!error || guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <label className="label">Tipo</label>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDePausa)}>
          {(Object.keys(TIPOS_DE_PAUSA) as TipoDePausa[]).map((t) => (
            <option key={t} value={t}>
              {TIPOS_DE_PAUSA[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="label">Nombre</label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={tipo === "feriado" ? "Ej: Día de la Independencia" : "Ej: Receso de invierno"} maxLength={80} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="label">{tipo === "feriado" ? "Día" : "Desde"}</label>
          <Input type="date" value={desde} min={ciclo.inicio.slice(0, 10)} max={ciclo.fin.slice(0, 10)} onChange={(e) => setDesde(e.target.value)} />
        </div>
        {tipo !== "feriado" && (
          <div className="space-y-1.5">
            <label className="label">Hasta</label>
            <Input type="date" value={hasta} min={desde || ciclo.inicio.slice(0, 10)} max={ciclo.fin.slice(0, 10)} onChange={(e) => setHasta(e.target.value)} />
          </div>
        )}
      </div>
      {(error || guardar.isError) && (
        <p className="text-sm text-destructive">{error ?? (guardar.error instanceof ApiError ? guardar.error.message : "No se pudo guardar la pausa")}</p>
      )}
    </Modal>
  );
}
