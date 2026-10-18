import { useState } from "react";
import { ChevronLeft, MessageSquarePlus, Send } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { ApiError } from "@/core/lib/apiClient";
import { NuevaConversacion } from "../components/NuevaConversacion";
import { BurbujaMensaje } from "../components/BurbujaMensaje";
import { VerAnteriores } from "../components/VerAnteriores";
import { useDesplazamientoDelChat } from "../hooks/useDesplazamientoDelChat";
import { useChats } from "../hooks/useChats";
import { useEnviarMensaje } from "../hooks/useEnviarMensaje";
import { useMarcarLeidoSiMira } from "../hooks/useMarcarLeidoSiMira";
import { useMensajes } from "../hooks/useMensajes";
import type { EstadoCuentaPadre } from "../types";
import { vistoDelUltimo } from "../visto";

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

// Bandeja compartida del instituto: conversaciones ordenadas por el último mensaje, con sus no leídos. La conversación
// abierta queda en la dirección (?conversacion=), así el aviso de la campana lleva directo a ella. No se abre ninguna
// sola: abrir una la marca leída, y eso tiene que ser una decisión de quien mira.
export default function ChatsAdminPage() {
  const { data: resumenes } = useChats();
  const { leer, escribir } = useFiltrosDeUrl();
  const pedida = leer("conversacion");
  // Un valor viejo o ajeno en la dirección no abre nada.
  const seleccionada = resumenes?.find((r) => r.chatId === pedida);
  const selectedId = seleccionada?.chatId;
  const abrir = (chatId: string | null) => escribir({ conversacion: chatId });

  const [nueva, setNueva] = useState(false);
  // Si la familia de una conversación recién abierta con "Nueva conversación" todavía no puede leerla.
  const [cuenta, setCuenta] = useState<{ chatId: string; estado: EstadoCuentaPadre } | null>(null);

  const { mensajes: lista, listo, hayAnteriores, cargarAnteriores, cargandoAnteriores } = useMensajes(selectedId);
  const enviarMensaje = useEnviarMensaje(selectedId);
  // El borrador es de una conversación: al cambiar a otra no se lleva (un mensaje escrito para una familia nunca debe
  // terminar enviado a otra).
  const [borrador, setBorrador] = useState({ chatId: selectedId, texto: "" });
  const texto = borrador.chatId === selectedId ? borrador.texto : "";
  const setTexto = (t: string) => setBorrador({ chatId: selectedId, texto: t });
  const visto = vistoDelUltimo(lista, true);
  // En el celular la lista y la conversación no entran lado a lado: con una conversación abierta se ve solo ella, y
  // "volver" la cierra (sale de la dirección). Así una conversación oculta detrás de la lista nunca se marca leída.
  useMarcarLeidoSiMira({ chatId: selectedId, mensajes: lista, soyInstituto: true, hayAnteriores, totalSinVer: seleccionada?.noLeidos ?? 0 });
  const scrollRef = useDesplazamientoDelChat(lista);


  const onEnviar = () => {
    if (!texto.trim()) return;
    enviarMensaje.mutate(texto.trim(), { onSuccess: () => setTexto("") });
  };

  return (
    <div className="card-hl flex overflow-hidden" style={{ height: "calc(100vh - 168px)", minHeight: 460 }}>
      <div
        className={`${seleccionada ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col md:w-[290px]`}
        style={{ borderRight: "1px solid var(--border-hex)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid var(--border-hex)" }}>
          <div>
            <h3 className="text-[13px] font-semibold">Conversaciones</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {resumenes?.length ?? 0} {resumenes?.length === 1 ? "familia" : "familias"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNueva(true)}>
            <MessageSquarePlus size={14} /> Nueva conversación
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {resumenes?.map((r) => (
            <div
              key={r.chatId}
              data-conversacion={r.chatId}
              onClick={() => {
                abrir(r.chatId);
                setCuenta(null);
              }}
              className="flex cursor-pointer items-start gap-2.5 px-4 py-3"
              style={{ borderBottom: "1px solid var(--border-hex)", background: selectedId === r.chatId ? "var(--bg-subtle)" : "transparent" }}
            >
              <Avatar name={r.padreNombre} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate text-[12.5px] ${r.noLeidos > 0 ? "font-semibold" : "font-medium"}`}>{r.padreNombre}</p>
                  {r.ultimoMensaje && <span className="shrink-0 text-[10px] text-muted-foreground">{fechaCorta(r.ultimoMensaje.fecha)}</span>}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{r.hijos.join(" · ") || "—"}</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                    {r.ultimoMensaje ? `${r.ultimoMensaje.delInstituto ? "Vos: " : ""}${r.ultimoMensaje.texto}` : "Sin mensajes todavía"}
                  </p>
                  {r.noLeidos > 0 && (
                    <span
                      data-no-leidos
                      className="min-w-4 shrink-0 rounded-full px-1.5 text-center text-[10px] font-semibold leading-4 text-white"
                      style={{ background: "var(--danger)" }}
                    >
                      {r.noLeidos}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {resumenes?.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin conversaciones.</p>}
        </div>
      </div>

      {seleccionada ? (
        <div data-conversacion-abierta={seleccionada.chatId} className="flex min-w-0 w-full flex-1 flex-col">
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border-hex)" }}>
            <button onClick={() => abrir(null)} aria-label="Volver a las conversaciones" className="-ml-1 rounded p-1 text-muted-foreground md:hidden">
              <ChevronLeft size={18} />
            </button>
            <Avatar name={seleccionada.padreNombre} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{seleccionada.padreNombre}</p>
              <p className="truncate text-[11px] text-muted-foreground">{seleccionada.hijos.join(" · ") || "—"}</p>
            </div>
          </div>
          {cuenta?.chatId === seleccionada.chatId && cuenta.estado !== "activa" && (
            <p className="px-4 py-2 text-[12px]" style={{ background: "var(--warning-soft)", borderBottom: "1px solid var(--border-hex)" }}>
              {cuenta.estado === "inactiva"
                ? "La cuenta está desactivada: no puede entrar al sistema, así que no va a ver la conversación hasta que se reactive."
                : "Todavía no entró al sistema: va a ver la conversación cuando entre."}
            </p>
          )}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4" style={{ background: "var(--bg-subtle)" }}>
            <VerAnteriores hay={hayAnteriores} cargando={cargandoAnteriores} onCargar={cargarAnteriores} />
            {listo && lista.length === 0 && <p className="py-8 text-center text-[12.5px] text-muted-foreground">Todavía no hay mensajes con esta familia.</p>}
            {lista.map((m, i) => {
              const mio = m.rolEmisor !== "padre";
              return (
                <BurbujaMensaje
                  key={m.id}
                  mensaje={m}
                  mio={mio}
                  etiqueta={mio ? undefined : seleccionada.padreNombre}
                  visto={i === lista.length - 1 ? visto : null}
                />
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
        <div className="hidden flex-1 items-center justify-center text-muted-foreground md:flex">
          <p className="text-[13px]">Seleccioná una conversación</p>
        </div>
      )}

      {nueva && (
        <NuevaConversacion
          onCerrar={() => setNueva(false)}
          onAbierta={(c) => {
            setNueva(false);
            abrir(c.id);
            setCuenta({ chatId: c.id, estado: c.estadoCuenta });
          }}
        />
      )}
    </div>
  );
}
