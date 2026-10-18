import { useMemo, useState } from "react";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { normalizarTexto } from "@/core/lib/utils";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { useIniciarConversacion } from "../hooks/useIniciarConversacion";
import type { ConversacionIniciada } from "../types";

// Busca un padre o madre (por nombre, apellido o DNI) y abre su conversación, creándola si no existía. El texto
// buscado no va a la dirección: son nombres y DNI.
export function NuevaConversacion({ onCerrar, onAbierta }: { onCerrar: () => void; onAbierta: (c: ConversacionIniciada) => void }) {
  const { data: padres } = usePadres();
  const iniciar = useIniciarConversacion();
  const [busqueda, setBusqueda] = useState("");

  const resultados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return [];
    return (padres ?? [])
      .filter((p) => normalizarTexto(`${p.nombre} ${p.apellido} ${p.dni}`).includes(termino))
      .slice(0, 8);
  }, [padres, busqueda]);

  return (
    <Modal title="Nueva conversación" onClose={onCerrar}>
      <Input autoFocus placeholder="Buscar por nombre, apellido o DNI…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      <div className="space-y-1">
        {resultados.map((p) => (
          <button
            key={p.id}
            data-padre-opcion
            disabled={iniciar.isPending}
            onClick={() => iniciar.mutate(p.id, { onSuccess: onAbierta })}
            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-[13px] hover:bg-accent"
          >
            <span>
              {p.nombre} {p.apellido}
            </span>
            <span className="text-[11.5px] text-muted-foreground">DNI {p.dni}</span>
          </button>
        ))}
        {busqueda.trim() && resultados.length === 0 && <p className="px-3 py-2 text-[12.5px] text-muted-foreground">No hay coincidencias.</p>}
        {iniciar.isError && (
          <p role="alert" className="px-3 py-2 text-[12.5px] text-destructive">
            No se pudo abrir la conversación. Probá de nuevo.
          </p>
        )}
      </div>
    </Modal>
  );
}
