import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ApiError } from "@/core/lib/apiClient";
import { BurbujaMensaje } from "../components/BurbujaMensaje";
import { VerAnteriores } from "../components/VerAnteriores";
import { useDesplazamientoDelChat } from "../hooks/useDesplazamientoDelChat";
import { useEnviarMensaje } from "../hooks/useEnviarMensaje";
import { useMensajes } from "../hooks/useMensajes";
import { useMarcarLeidoSiMira } from "../hooks/useMarcarLeidoSiMira";
import { useMiChat } from "../hooks/useMiChat";
import { vistoDelUltimo } from "../visto";

export default function ChatPage() {
  const { data: chat } = useMiChat();
  const { mensajes: lista, listo, hayAnteriores, cargarAnteriores, cargandoAnteriores } = useMensajes(chat?.id);
  const enviarMensaje = useEnviarMensaje(chat?.id);
  const visto = vistoDelUltimo(lista, false);
  useMarcarLeidoSiMira({ chatId: chat?.id, mensajes: lista, soyInstituto: false, hayAnteriores, totalSinVer: chat?.noLeidos ?? 0 });
  const scrollRef = useDesplazamientoDelChat(lista);

  const [texto, setTexto] = useState("");

  const onEnviar = () => {
    if (!texto.trim()) return;
    enviarMensaje.mutate(texto.trim(), { onSuccess: () => setTexto("") });
  };

  return (
    <div className="card-hl flex max-w-3xl flex-col overflow-hidden" style={{ height: "calc(100vh - 300px)", minHeight: 420 }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-hex)" }}>
        <p className="eyebrow mb-1">Mensajes</p>
        <h3 className="text-[14px] font-semibold tracking-tight">Conversación con Administración</h3>
        <p className="mt-1 text-[11.5px] text-muted-foreground">Secretaría y dirección del instituto</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ background: "var(--bg-subtle)" }}>
        <VerAnteriores hay={hayAnteriores} cargando={cargandoAnteriores} onCargar={cargarAnteriores} />
        {listo && lista.length === 0 && (
          <p className="py-8 text-center text-[12.5px] text-muted-foreground">
            Escribinos si necesitás consultar algo con administración.
          </p>
        )}
        {lista.map((m, i) => {
          const mio = m.rolEmisor === "padre";
          const etiqueta = mio ? undefined : `${m.rolEmisor === "admin" ? "Dirección" : "Secretaría"}${m.emisorNombre ? ` — ${m.emisorNombre}` : ""}`;
          return <BurbujaMensaje key={m.id} mensaje={m} mio={mio} etiqueta={etiqueta} visto={i === lista.length - 1 ? visto : null} />;
        })}
      </div>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-hex)" }}>
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onEnviar();
            }
          }}
          placeholder="Escribí tu consulta…"
          className="flex-1"
        />
        <Button size="icon" onClick={onEnviar} disabled={enviarMensaje.isPending || !texto.trim()}>
          <Send size={14} />
        </Button>
      </div>
      {enviarMensaje.isError && (
        <p className="px-4 pb-2 text-sm text-destructive">
          {enviarMensaje.error instanceof ApiError ? enviarMensaje.error.message : "No se pudo enviar el mensaje"}
        </p>
      )}
    </div>
  );
}
