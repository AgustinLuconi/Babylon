import { Info, X } from "lucide-react";

// El aviso fijo de "Mientras editabas, X cambió…" dentro de un formulario de edición.
export function AvisoDeCambioAjeno({ aviso, onCerrar }: { aviso: string | null; onCerrar: () => void }) {
  if (!aviso) return null;
  return (
    <div role="status" data-aviso-cambio-ajeno className="flex items-start gap-2 rounded px-3 py-2.5 text-[13px]" style={{ background: "var(--warning-soft)" }}>
      <Info size={15} className="mt-0.5 shrink-0" />
      <span className="flex-1">{aviso}</span>
      <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}
