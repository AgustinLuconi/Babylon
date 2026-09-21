import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ApiError } from "@/core/lib/apiClient";
import { useEnviarMensaje } from "../hooks/useEnviarMensaje";
import { useMensajes } from "../hooks/useMensajes";
import { useMiChat } from "../hooks/useMiChat";

export default function ChatPage() {
  const { data: chat } = useMiChat();
  const { data: mensajes } = useMensajes(chat?.id);
  const enviarMensaje = useEnviarMensaje(chat?.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes?.length]);

  const onEnviar = () => {
    if (!texto.trim()) return;
    enviarMensaje.mutate(texto.trim(), { onSuccess: () => setTexto("") });
  };

  return (
    <div className="card-hl mx-auto flex max-w-3xl flex-col overflow-hidden" style={{ height: "calc(100vh - 300px)", minHeight: 420 }}>
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-hex)" }}>
        <p className="eyebrow mb-1">Mensajes</p>
        <h3 className="text-[14px] font-semibold tracking-tight">Conversación con Administración</h3>
        <p className="mt-1 text-[11.5px] text-muted-foreground">Secretaría y dirección del instituto</p>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ background: "var(--bg-subtle)" }}>
        {mensajes?.length === 0 && (
          <p className="py-8 text-center text-[12.5px] text-muted-foreground">
            Escribinos si necesitás consultar algo con administración.
          </p>
        )}
        {mensajes?.map((m) => {
          const mine = m.rolEmisor === "padre";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[78%] px-3 py-2.5"
                style={{
                  borderRadius: mine ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                  background: mine ? "var(--brand)" : "var(--bg-muted)",
                  color: mine ? "#fff" : "var(--text)",
                }}
              >
                {!mine && (
                  <p className="mb-1 text-[10.5px] font-semibold text-muted-foreground">
                    {m.rolEmisor === "admin" ? "Dirección" : "Secretaría"}
                  </p>
                )}
                <p className="text-[13px] leading-relaxed">{m.texto}</p>
                <p className="mt-1 text-right text-[10px]" style={{ opacity: mine ? 0.75 : 0.55 }}>
                  {new Date(m.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
                </p>
              </div>
            </div>
          );
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
