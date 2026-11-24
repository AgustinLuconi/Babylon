import { useMemo, useState } from "react";
import { AvisoDeCambioAjeno } from "@/core/formularios/AvisoDeCambioAjeno";
import { useFormularioAlDia } from "@/core/formularios/useFormularioAlDia";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha } from "@/core/lib/utils";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { validarFechasDelCiclo, calendarioDelCiclo } from "../calendario";
import { useCiclos } from "../hooks/useCiclos";
import { useEditarFechasDelCiclo } from "../hooks/useEditarFechasDelCiclo";
import { useEliminarPausa } from "../hooks/useEliminarPausa";
import type { Ciclo, PausaDelCiclo } from "../types";
import { TIPOS_DE_PAUSA } from "../tiposDePausa";
import { ModalDePausa } from "./ModalDePausa";

const rango = (p: PausaDelCiclo) => (p.desde.slice(0, 10) === p.hasta.slice(0, 10) ? formatFecha(p.desde) : `${formatFecha(p.desde)} al ${formatFecha(p.hasta)}`);

// Inicio y fin de cada ciclo lectivo y sus pausas (receso de invierno, feriados): de ahí salen los meses con cuota y los
// días en que se puede tomar asistencia.
export function PanelCalendarioDeCiclos() {
  const { data: ciclos, isLoading } = useCiclos();
  return (
    <Panel title="Inicio y fin de cada ciclo lectivo">
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Sin clases en estas fechas: no se toma asistencia. Las cuotas se generan en los meses que tienen al menos un día de clases (un receso no anula el mes). Si no
          cargás fechas, el ciclo va del 1 de marzo al 30 de noviembre, sin pausas.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {ciclos?.map((ciclo) => (
          <TarjetaDeCalendario key={ciclo.id} ciclo={ciclo} />
        ))}
      </div>
    </Panel>
  );
}

function TarjetaDeCalendario({ ciclo }: { ciclo: Ciclo }) {
  const editarFechas = useEditarFechasDelCiclo();
  const eliminar = useEliminarPausa();
  const [modal, setModal] = useState<{ pausa?: PausaDelCiclo } | null>(null);
  const [borrando, setBorrando] = useState<PausaDelCiclo | null>(null);

  // Las fechas escritas arrancan en lo que dice el servidor; si otra persona las cambia mientras se editan, las que no se
  // tocaron se ponen al día solas (con un aviso de quién y qué) y lo escrito se conserva.
  const servidor = useMemo(() => ({ inicio: ciclo.inicio.slice(0, 10), fin: ciclo.fin.slice(0, 10) }), [ciclo.inicio, ciclo.fin]);
  const [inicio, setInicio] = useState(servidor.inicio);
  const [fin, setFin] = useState(servidor.fin);
  const alDia = useFormularioAlDia<{ inicio: string; fin: string }>({
    activo: true,
    dato: "ciclos",
    claveDeId: "cicloIds",
    id: ciclo.id,
    servidor,
    etiquetas: { inicio: "el inicio de clases", fin: "el fin de clases" },
    valores: { inicio, fin },
    aplicar: (parcial) => {
      if (parcial.inicio !== undefined) setInicio(parcial.inicio);
      if (parcial.fin !== undefined) setFin(parcial.fin);
    },
  });

  const cambioFechas = inicio !== servidor.inicio || fin !== servidor.fin;
  useSinGuardar(cambioFechas);
  // Con una fecha borrada no se puede guardar (no hay qué mandar).
  const completas = inicio !== "" && fin !== "";
  const error = cambioFechas && completas ? validarFechasDelCiclo({ ...calendarioDelCiclo(ciclo), inicio, fin }) : null;
  const sololectura = ciclo.bloqueado;

  const onGuardarFechas = () => {
    if (!cambioFechas || !completas || error) return;
    editarFechas.mutate({ cicloId: ciclo.id, datos: { inicio, fin } });
  };

  return (
    <div className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--border-hex)" }} data-testid={`calendario-${ciclo.anio}`}>
      <div className="flex items-center gap-2.5">
        <span className="tnum text-[15px] font-semibold">{ciclo.anio}</span>
        {ciclo.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="neutral">Histórico</Badge>}
        {ciclo.bloqueado && <Badge variant="warning">Bloqueado</Badge>}
      </div>

      <AvisoDeCambioAjeno aviso={alDia.aviso} onCerrar={alDia.descartarAviso} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="label">Inicio de clases</label>
          <Input type="date" value={inicio} disabled={sololectura} onChange={(e) => setInicio(e.target.value)} className={`w-44 ${alDia.resaltados.has("inicio") ? "cambio-resaltado" : ""}`} aria-label={`Inicio de clases ${ciclo.anio}`} />
        </div>
        <div className="space-y-1.5">
          <label className="label">Fin de clases</label>
          <Input type="date" value={fin} disabled={sololectura} onChange={(e) => setFin(e.target.value)} className={`w-44 ${alDia.resaltados.has("fin") ? "cambio-resaltado" : ""}`} aria-label={`Fin de clases ${ciclo.anio}`} />
        </div>
        {!sololectura && (
          <Button onClick={onGuardarFechas} disabled={!cambioFechas || !completas || !!error || editarFechas.isPending}>
            {editarFechas.isPending ? "Guardando…" : "Guardar fechas"}
          </Button>
        )}
      </div>
      {(error || editarFechas.isError) && (
        <p className="text-sm text-destructive">{error ?? (editarFechas.error instanceof ApiError ? editarFechas.error.message : "No se pudieron guardar las fechas")}</p>
      )}

      <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--border-hex)" }}>
        <div className="flex items-center justify-between">
          <p className="eyebrow">Pausas (sin clases)</p>
          {!sololectura && (
            <Button variant="outline" size="sm" onClick={() => setModal({})}>
              <Plus className="mr-1.5" size={14} /> Agregar pausa
            </Button>
          )}
        </div>
        {ciclo.pausas.length === 0 && <p className="text-[12.5px] text-muted-foreground">Todavía no hay pausas cargadas.</p>}
        {ciclo.pausas.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2" style={{ borderColor: "var(--border-hex)" }}>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{p.nombre}</p>
              <p className="tnum text-[12px] text-muted-foreground">
                {TIPOS_DE_PAUSA[p.tipo]} · {rango(p)}
              </p>
            </div>
            {!sololectura && (
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" aria-label={`Editar ${p.nombre}`} onClick={() => setModal({ pausa: p })}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Borrar ${p.nombre}`} onClick={() => setBorrando(p)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {modal && <ModalDePausa ciclo={ciclo} pausa={modal.pausa} onClose={() => setModal(null)} />}
      {borrando && (
        <Modal
          title="Borrar pausa"
          onClose={() => setBorrando(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setBorrando(null)}>
                Cancelar
              </Button>
              <Button disabled={eliminar.isPending} onClick={() => eliminar.mutate({ cicloId: ciclo.id, pausaId: borrando.id }, { onSuccess: () => setBorrando(null) })}>
                Borrar
              </Button>
            </>
          }
        >
          <p className="text-[13px]">
            ¿Borrar “{borrando.nombre}” ({rango(borrando)})? Esos días vuelven a contar como días de clases. Lo que ya se guardó (asistencia, cuotas) no se modifica.
          </p>
          {eliminar.isError && <p className="text-sm text-destructive">{eliminar.error instanceof ApiError ? eliminar.error.message : "No se pudo borrar la pausa"}</p>}
        </Modal>
      )}
    </div>
  );
}
