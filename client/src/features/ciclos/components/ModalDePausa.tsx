import { useMemo, useState } from "react";
import { AvisoDeCambioAjeno } from "@/core/formularios/AvisoDeCambioAjeno";
import { useFormularioAlDia } from "@/core/formularios/useFormularioAlDia";
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
  // Al editar: lo que dice el servidor de esta pausa ahora (null si otra persona la borró mientras el modal estaba abierto).
  const pausaActual = pausa ? ciclo.pausas.find((p) => p.id === pausa.id) : undefined;
  const eliminada = !!pausa && !pausaActual;
  const servidor = useMemo(
    () => (pausaActual ? { nombre: pausaActual.nombre, tipo: pausaActual.tipo as string, desde: pausaActual.desde.slice(0, 10), hasta: pausaActual.hasta.slice(0, 10) } : undefined),
    [pausaActual],
  );
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
  // Si otra persona edita esta pausa mientras se la edita acá, lo que no se tocó se pone al día solo y un aviso dice quién y qué.
  const alDia = useFormularioAlDia<{ nombre: string; tipo: string; desde: string; hasta: string }>({
    activo: !!pausa,
    dato: "ciclos",
    claveDeId: "cicloIds",
    id: ciclo.id,
    servidor,
    etiquetas: { nombre: "el nombre", tipo: "el tipo", desde: "la fecha de inicio", hasta: "la fecha de fin" },
    valores: { nombre, tipo, desde, hasta },
    aplicar: (parcial) => {
      if (parcial.nombre !== undefined) setNombre(parcial.nombre);
      if (parcial.tipo !== undefined) setTipo(parcial.tipo as TipoDePausa);
      if (parcial.desde !== undefined) setDesde(parcial.desde);
      if (parcial.hasta !== undefined) setHasta(parcial.hasta);
    },
  });

  const hastaEfectivo = tipo === "feriado" ? desde : hasta;
  const referencia = servidor ?? inicial;
  const sinGuardar = nombre !== referencia.nombre || tipo !== referencia.tipo || desde !== referencia.desde || hasta !== referencia.hasta;
  const completo = nombre.trim() !== "" && desde !== "" && hastaEfectivo !== "";
  const otras = calendarioDelCiclo(ciclo).pausas.filter((_, i) => ciclo.pausas[i].id !== pausa?.id);
  const error = completo ? validarPausa(calendarioDelCiclo(ciclo), { desde, hasta: hastaEfectivo, nombre }, otras) : null;

  const onGuardar = () => {
    if (!completo || error || eliminada) return;
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
          <Button onClick={onGuardar} disabled={!completo || !!error || eliminada || guardar.isPending}>
            {guardar.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </>
      }
    >
      <AvisoDeCambioAjeno aviso={alDia.aviso} onCerrar={alDia.descartarAviso} />
      {eliminada && <p className="text-sm text-destructive">Otra persona borró esta pausa mientras la editabas: ya no se puede guardar.</p>}
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
