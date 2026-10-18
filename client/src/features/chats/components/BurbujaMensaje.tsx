import type { Mensaje } from "../types";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

// Un mensaje con su hora de envío. `visto` (la hora en que se vio) solo lo recibe el último mensaje propio ya leído.
export function BurbujaMensaje({ mensaje, mio, etiqueta, visto }: { mensaje: Mensaje; mio: boolean; etiqueta?: string; visto?: string | null }) {
  return (
    <div data-mensaje className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      <div
        className="max-w-[78%] px-3 py-2.5"
        style={{
          borderRadius: mio ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
          background: mio ? "var(--brand)" : "var(--bg-muted)",
          color: mio ? "#fff" : "var(--text)",
        }}
      >
        {etiqueta && <p className="mb-1 text-[10.5px] font-semibold text-muted-foreground">{etiqueta}</p>}
        <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{mensaje.texto}</p>
        <p data-hora className="mt-1 text-right text-[10px]" style={{ opacity: mio ? 0.75 : 0.55 }}>
          {hora(mensaje.fecha)}
        </p>
      </div>
      {visto && (
        <p data-visto className="mt-1 text-[10.5px] text-muted-foreground">
          Visto · {hora(visto)}
        </p>
      )}
    </div>
  );
}
