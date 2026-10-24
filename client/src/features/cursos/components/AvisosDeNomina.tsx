import { Info, X } from "lucide-react";
import type { AvisoDeNomina } from "../hooks/useAvisosDeNomina";

// Avisos fijos de las pantallas de carga del profesor: qué cambió en su nómina, o que el curso ya no está a su cargo.
// Quedan hasta que el profesor los cierra.
export function AvisosDeNomina({ avisos, onCerrar, cursoPerdido }: { avisos: AvisoDeNomina[]; onCerrar: (id: string) => void; cursoPerdido: boolean }) {
  if (avisos.length === 0 && !cursoPerdido) return null;
  return (
    <div className="space-y-2">
      {cursoPerdido && (
        <div role="alert" className="flex items-center gap-2 rounded px-4 py-2.5 text-[13px]" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          <Info size={15} />
          <span>Este curso ya no está a tu cargo</span>
        </div>
      )}
      {avisos.map((a) => (
        <div key={a.id} data-aviso-nomina className="flex items-center gap-2 rounded px-4 py-2.5 text-[13px]" style={{ background: "var(--warning-soft)" }}>
          <Info size={15} />
          <span className="flex-1">{a.texto}</span>
          <button onClick={() => onCerrar(a.id)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
