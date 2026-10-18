import { useEffect, useRef, useState } from "react";
import type { Mensaje } from "../types";
import { noLeidos } from "../visto";
import { useMarcarLeido } from "./useMarcarLeido";

const REINTENTOS = 3;

interface Opciones {
  chatId: string | undefined;
  // Lo cargado en pantalla, del más viejo al más reciente.
  mensajes: Mensaje[];
  soyInstituto: boolean;
  // Si hay páginas anteriores sin cargar y cuántos mensajes del otro lado hay sin ver en toda la conversación.
  hayAnteriores: boolean;
  totalSinVer: number;
}

// Marca leída la conversación solo si está en pantalla (quien la usa la monta solo cuando se ve), la pestaña está
// visible y hay algo del otro lado sin ver. Marca los mensajes que se ven (por id) y lo anterior a lo cargado: lo que
// llegue después se marca cuando aparezca. Una pestaña en segundo plano no marca nada; cuando vuelve a estar visible,
// recién ahí. Si el pedido falla, se reintenta solo (hasta 3 veces).
export function useMarcarLeidoSiMira({ chatId, mensajes, soyInstituto, hayAnteriores, totalSinVer }: Opciones): void {
  const { mutate } = useMarcarLeido();
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  // Lo último que se pidió marcar: evita repetir el pedido mientras la lista vuelve a cargarse.
  const pedido = useRef<string | null>(null);
  const [reintento, setReintento] = useState(0);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => {
    const alCambiar = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", alCambiar);
    return () => {
      document.removeEventListener("visibilitychange", alCambiar);
      window.clearTimeout(temporizador.current);
    };
  }, []);

  // Cuáles hay sin ver (no cuántos): dos mensajes enviados casi a la vez pueden confirmarse en otro orden, y uno con
  // fecha anterior al último aparece después sin que el último cambie. Tiene que marcarse igual.
  const ids = noLeidos(mensajes, soyInstituto)
    .map((m) => m.id)
    .join(",");
  // Lo anterior a lo cargado solo importa si hay algo sin ver ahí (el total supera lo que se ve).
  const antesDe = hayAnteriores && totalSinVer > noLeidos(mensajes, soyInstituto).length ? mensajes[0]?.fecha : undefined;
  useEffect(() => {
    if (!chatId || (!ids && !antesDe) || !visible) return;
    const clave = `${chatId}|${ids}|${antesDe ?? ""}`;
    if (pedido.current === clave) return;
    pedido.current = clave;
    mutate(
      { chatId, ids: ids ? ids.split(",") : [], antesDe },
      {
        onSuccess: () => setReintento(0),
        onError: () => {
          pedido.current = null;
          if (reintento < REINTENTOS) temporizador.current = window.setTimeout(() => setReintento((n) => n + 1), 3000 * (reintento + 1));
        },
      },
    );
  }, [chatId, ids, antesDe, visible, mutate, reintento]);
}
