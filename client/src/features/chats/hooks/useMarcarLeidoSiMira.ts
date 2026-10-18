import { useEffect, useRef, useState } from "react";
import type { Mensaje } from "../types";
import { noLeidos } from "../visto";
import { useMarcarLeido } from "./useMarcarLeido";

// Marca leída la conversación solo si está en pantalla (quien la usa la monta solo cuando se ve), la pestaña está
// visible y hay algo del otro lado sin ver. Marca hasta el último mensaje mostrado: lo que llegue después se marca
// cuando aparezca. Una pestaña en segundo plano no marca nada; cuando vuelve a estar visible, recién ahí.
export function useMarcarLeidoSiMira(chatId: string | undefined, mensajes: Mensaje[], soyInstituto: boolean): void {
  const { mutate } = useMarcarLeido();
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  // Lo último que se pidió marcar: evita repetir el pedido mientras la lista vuelve a cargarse.
  const pedido = useRef<string | null>(null);

  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  // Cuáles hay sin ver (no cuántos): dos mensajes enviados casi a la vez pueden confirmarse en otro orden, y uno con
  // fecha anterior al último aparece después sin que el último cambie. Tiene que marcarse igual.
  const sinVer = noLeidos(mensajes, soyInstituto)
    .map((m) => m.id)
    .join(",");
  const hasta = mensajes.at(-1)?.fecha;
  useEffect(() => {
    if (!chatId || !hasta || !sinVer || !visible) return;
    const clave = `${chatId}|${hasta}|${sinVer}`;
    if (pedido.current === clave) return;
    pedido.current = clave;
    // Si falla, se reintenta cuando cambie lo que hay en pantalla (un mensaje nuevo o volver a la pestaña).
    mutate(
      { chatId, hasta },
      {
        onError: () => {
          pedido.current = null;
        },
      },
    );
  }, [chatId, hasta, sinVer, visible, mutate]);
}
