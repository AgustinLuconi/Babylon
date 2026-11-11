import { useEffect, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { mensajeDeError } from "@/core/lib/erroresDeCampo";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { MINUTOS_PARA_CORREGIR, puedeCorregir } from "../correccion";
import { MAX_MENSAJE, type Mensaje } from "../types";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export interface AccionesDelMensaje {
  editar: (mensajeId: string, texto: string) => Promise<unknown>;
  eliminar: (mensajeId: string) => Promise<unknown>;
}

interface Props {
  mensaje: Mensaje;
  mio: boolean;
  etiqueta?: string;
  // `visto` (la hora en que se vio) solo lo recibe el último mensaje propio ya leído.
  visto?: string | null;
  // Con esto, un mensaje de tu lado se puede corregir o eliminar durante los primeros 15 minutos.
  acciones?: AccionesDelMensaje;
  soyInstituto?: boolean;
}

// Un mensaje con su hora de envío, "(editado)" si se corrigió y "Se eliminó este mensaje" si se eliminó.
export function BurbujaMensaje({ mensaje, mio, etiqueta, visto, acciones, soyInstituto = false }: Props) {
  const [modo, setModo] = useState<"normal" | "menu" | "editando" | "confirmando">("normal");
  const [borrador, setBorrador] = useState(mensaje.texto);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  // Pasado el plazo, el menú desaparece solo (sin recargar): se vuelve a evaluar justo al vencer.
  const [, repintar] = useState(0);
  const vence = new Date(mensaje.fecha).getTime() + MINUTOS_PARA_CORREGIR * 60_000;
  useEffect(() => {
    if (!acciones || mensaje.eliminadoEn) return;
    const falta = vence - Date.now();
    if (falta <= 0) return;
    const t = window.setTimeout(() => repintar((n) => n + 1), Math.min(falta + 50, 2_000_000_000));
    return () => window.clearTimeout(t);
  }, [acciones, mensaje.eliminadoEn, vence]);

  const corregible = Boolean(acciones) && puedeCorregir(mensaje, soyInstituto);
  const editando = modo === "editando";
  useSinGuardar(editando && borrador.trim() !== mensaje.texto);
  const eliminado = Boolean(mensaje.eliminadoEn);
  // Si venció el plazo (o el mensaje cambió) mientras estaba abierto el menú o la edición, se vuelve a lo normal.
  const modoVisible = !corregible && modo !== "normal" ? "normal" : modo;

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      setModo("normal");
    } catch (e) {
      setError(mensajeDeError(e) ?? "No se pudo completar la acción");
    } finally {
      setTrabajando(false);
    }
  };
  const guardar = () => {
    const texto = borrador.trim();
    if (!texto || !acciones) return;
    if (texto === mensaje.texto) return setModo("normal");
    void ejecutar(() => acciones.editar(mensaje.id, texto));
  };

  return (
    <div data-mensaje className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      <div className="flex max-w-[78%] items-start gap-1.5" style={{ flexDirection: mio ? "row-reverse" : "row" }}>
        <div
          className="min-w-0 px-3 py-2.5"
          style={{
            borderRadius: mio ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
            background: mio ? "var(--brand)" : "var(--bg-muted)",
            color: mio ? "#fff" : "var(--text)",
          }}
        >
          {etiqueta && <p className="mb-1 text-[10.5px] font-semibold text-muted-foreground">{etiqueta}</p>}
          {eliminado ? (
            <p data-eliminado className="text-[12.5px] italic" style={{ opacity: 0.75 }}>
              Se eliminó este mensaje
            </p>
          ) : modoVisible === "editando" ? (
            <div className="space-y-2">
              <textarea
                data-editar-texto
                autoFocus
                rows={2}
                maxLength={MAX_MENSAJE}
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    guardar();
                  } else if (e.key === "Escape") {
                    setModo("normal");
                    setError(null);
                  }
                }}
                className="w-full min-w-[200px] resize-none rounded px-2 py-1 text-[13px]"
                style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border-hex)" }}
              />
              <div className="flex justify-end gap-2 text-[11.5px]">
                <button type="button" onClick={() => { setModo("normal"); setError(null); }} className="underline" style={{ opacity: 0.85 }}>
                  Cancelar
                </button>
                <button type="button" data-guardar-edicion onClick={guardar} disabled={trabajando || !borrador.trim()} className="font-semibold underline">
                  {trabajando ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{mensaje.texto}</p>
          )}
          <p data-hora className="mt-1 text-right text-[10px]" style={{ opacity: mio ? 0.75 : 0.55 }}>
            {!eliminado && mensaje.editadoEn && <span data-editado>(editado) </span>}
            {hora(mensaje.fecha)}
          </p>
        </div>
        {corregible && modoVisible !== "editando" && (
          <div className="relative shrink-0">
            <button
              type="button"
              data-menu-mensaje
              aria-label="Opciones del mensaje"
              onClick={() => setModo(modoVisible === "menu" ? "normal" : "menu")}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <MoreHorizontal size={14} />
            </button>
            {modoVisible === "menu" && (
              <div
                className="absolute z-10 mt-1 min-w-[110px] rounded border bg-background py-1 text-[12px] shadow-md"
                style={{ [mio ? "right" : "left"]: 0, borderColor: "var(--border-hex)" }}
              >
                <button
                  type="button"
                  data-accion-editar
                  className="block w-full px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    setBorrador(mensaje.texto);
                    setModo("editando");
                  }}
                >
                  Editar
                </button>
                <button type="button" data-accion-eliminar className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={() => setModo("confirmando")}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {modoVisible === "confirmando" && acciones && (
        <div data-confirmar-eliminar className="mt-1 flex items-center gap-2 text-[11.5px]">
          <span className="text-muted-foreground">¿Eliminar este mensaje?</span>
          <button type="button" onClick={() => setModo("normal")} className="underline">
            Cancelar
          </button>
          <button type="button" data-confirmar disabled={trabajando} onClick={() => void ejecutar(() => acciones.eliminar(mensaje.id))} className="font-semibold underline" style={{ color: "var(--danger)" }}>
            {trabajando ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-[11.5px] text-destructive">{error}</p>}
      {visto && !eliminado && (
        <p data-visto className="mt-1 text-[10.5px] text-muted-foreground">
          Visto · {hora(visto)}
        </p>
      )}
    </div>
  );
}
