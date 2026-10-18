import { useLayoutEffect, useRef } from "react";
import type { Mensaje } from "../types";

// Mantiene la conversación en su lugar: un mensaje nuevo al final (o abrir otra conversación) lleva al final; cargar
// mensajes anteriores deja a la vista lo que ya se estaba leyendo, sin saltar.
export function useDesplazamientoDelChat(mensajes: Mensaje[]) {
  const ref = useRef<HTMLDivElement>(null);
  const previo = useRef<{ primero?: string; ultimo?: string; alto: number }>({ alto: 0 });
  const primero = mensajes[0]?.id;
  const ultimo = mensajes.at(-1)?.id;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const antes = previo.current;
    if (ultimo !== antes.ultimo) el.scrollTop = el.scrollHeight;
    else if (primero !== antes.primero) el.scrollTop += el.scrollHeight - antes.alto;
    previo.current = { primero, ultimo, alto: el.scrollHeight };
  }, [primero, ultimo]);
  return ref;
}
