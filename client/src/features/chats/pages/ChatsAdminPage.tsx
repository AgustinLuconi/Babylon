import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, Send } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { ApiError } from "@/core/lib/apiClient";
import { useAlumnos } from "@/features/alumnos/hooks/useAlumnos";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { chatService } from "../chatService";
import { useChats } from "../hooks/useChats";
import { useEnviarMensaje } from "../hooks/useEnviarMensaje";
import { useMensajes } from "../hooks/useMensajes";

export default function ChatsAdminPage() {
  const { data: chats } = useChats();
  const { data: padres } = usePadres();
  const { data: alumnos } = useAlumnos();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // En mobile la lista y la conversación no entran lado a lado — se muestra
  // una por vez. En md+ esto se ignora y siempre se ven las dos juntas.
  const [vistaMobil, setVistaMobil] = useState<"lista" | "chat">("lista");
  const scrollRef = useRef<HTMLDivElement>(null);

  const nombresPorPadre = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const p of padres ?? []) mapa.set(p.id, `${p.nombre} ${p.apellido}`);
    return mapa;
  }, [padres]);

  const hijosPorPadre = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const a of alumnos ?? []) {
      if (!a.padreId) continue;
      const lista = mapa.get(a.padreId) ?? [];
      lista.push(`${a.nombre} ${a.apellido}`);
      mapa.set(a.padreId, lista);
    }
    return mapa;
  }, [alumnos]);

  const mensajesQueries = useQueries({
    queries: (chats ?? []).map((c) => ({
      queryKey: ["mensajes", c.id],
      queryFn: () => chatService.listarMensajes(c.id),
    })),
  });

  const threads = useMemo(() => {
    return (chats ?? [])
      .map((c, i) => {
        const mensajes = mensajesQueries[i]?.data ?? [];
        const ultimo = mensajes[mensajes.length - 1];
        return {
          chat: c,
          nombrePadre: nombresPorPadre.get(c.padreId) ?? "Familia",
          hijos: hijosPorPadre.get(c.padreId) ?? [],
          ultimoTexto: ultimo ? `${ultimo.rolEmisor !== "padre" ? "Vos: " : ""}${ultimo.texto}` : "Sin mensajes todavía",
          ultimaFecha: ultimo?.fecha,
        };
      })
      .sort((a, b) => (b.ultimaFecha ?? b.chat.creadoEn).localeCompare(a.ultimaFecha ?? a.chat.creadoEn));
  }, [chats, mensajesQueries, nombresPorPadre, hijosPorPadre]);

  useEffect(() => {
    if (!selectedId && threads.length > 0) setSelectedId(threads[0].chat.id);
  }, [threads, selectedId]);

  const { data: mensajes } = useMensajes(selectedId);
  const enviarMensaje = useEnviarMensaje(selectedId);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes?.length, selectedId]);

  const onEnviar = () => {
    if (!texto.trim()) return;
    enviarMensaje.mutate(texto.trim(), { onSuccess: () => setTexto("") });
  };

  const threadSeleccionado = threads.find((t) => t.chat.id === selectedId);

  return (
    <div className="card-hl flex overflow-hidden" style={{ height: "calc(100vh - 168px)", minHeight: 460 }}>
      <div
        className={`${vistaMobil === "chat" ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col md:w-[290px]`}
        style={{ borderRight: "1px solid var(--border-hex)" }}
      >
        <div className="px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-hex)" }}>
          <h3 className="text-[13px] font-semibold">Conversaciones</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{threads.length} {threads.length === 1 ? "familia" : "familias"}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads.map((t) => (
            <div
              key={t.chat.id}
              onClick={() => {
                setSelectedId(t.chat.id);
                setVistaMobil("chat");
              }}
              className="flex cursor-pointer items-start gap-2.5 px-4 py-3"
              style={{
                borderBottom: "1px solid var(--border-hex)",
                background: selectedId === t.chat.id ? "var(--bg-subtle)" : "transparent",
              }}
            >
              <Avatar name={t.nombrePadre} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-medium">{t.nombrePadre}</p>
                  {t.ultimaFecha && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {new Date(t.ultimaFecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{t.hijos.join(" · ") || "—"}</p>
                <p className="mt-1 truncate text-[12px] text-muted-foreground">{t.ultimoTexto}</p>
              </div>
            </div>
          ))}
          {threads.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin conversaciones.</p>}
        </div>
      </div>

      {threadSeleccionado ? (
        <div className={`${vistaMobil === "lista" ? "hidden md:flex" : "flex"} min-w-0 w-full flex-1 flex-col`}>
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-hex)" }}>
            <button onClick={() => setVistaMobil("lista")} className="-ml-1 rounded p-1 text-muted-foreground md:hidden">
              <ChevronLeft size={18} />
            </button>
            <Avatar name={threadSeleccionado.nombrePadre} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{threadSeleccionado.nombrePadre}</p>
              <p className="truncate text-[11px] text-muted-foreground">{threadSeleccionado.hijos.join(" · ") || "—"}</p>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ background: "var(--bg-subtle)" }}>
            {mensajes?.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-muted-foreground">Todavía no hay mensajes con esta familia.</p>
            )}
            {mensajes?.map((m) => {
              const mine = m.rolEmisor !== "padre";
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
                    {!mine && <p className="mb-1 text-[10.5px] font-semibold text-muted-foreground">{threadSeleccionado.nombrePadre}</p>}
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
              placeholder="Escribir un mensaje…"
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
      ) : (
        <div className={`${vistaMobil === "lista" ? "hidden md:flex" : "flex"} flex-1 items-center justify-center text-muted-foreground`}>
          <p className="text-[13px]">Seleccioná una conversación</p>
        </div>
      )}
    </div>
  );
}
