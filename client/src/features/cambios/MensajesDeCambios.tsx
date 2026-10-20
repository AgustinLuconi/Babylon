import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { cerrarMensajeDeCambio, useMensajesDeCambiosStore } from "./cola";
import { textoDelCambio } from "./mensajes";
import { nombresDesdeLaCache } from "./nombres";

// Abajo a la derecha: "Lucía cobró la cuota de octubre de Tomás Rodríguez". Se van solos a los 5 s.
export function MensajesDeCambios() {
  const mensajes = useMensajesDeCambiosStore((e) => e.mensajes);
  const queryClient = useQueryClient();
  const nombres = nombresDesdeLaCache(queryClient);
  const visibles = mensajes.map((m) => ({ clave: m.clave, texto: textoDelCambio(m.cambio, nombres) })).filter((m) => m.texto !== null);
  if (visibles.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {visibles.map((m) => (
        <div
          key={m.clave}
          data-mensaje-cambio
          className="pointer-events-auto flex items-start gap-2 rounded px-3 py-2 text-[12.5px] text-white shadow-lg"
          style={{ background: "var(--sidebar-bg)" }}
        >
          <span>{m.texto}</span>
          <button onClick={() => cerrarMensajeDeCambio(m.clave)} aria-label="Cerrar" className="opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
