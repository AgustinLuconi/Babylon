import type { ReactNode } from "react";
import { useResaltado } from "@/core/hooks/useResaltado";

// Un número o estado que se ilumina un momento cuando cambia por algo que hizo otra persona.
// `bloque` lo dibuja como un bloque (para envolver tarjetas o párrafos).
export function Resaltable({ valor, datos, bloque = false, children }: { valor: unknown; datos?: readonly string[]; bloque?: boolean; children: ReactNode }) {
  const resaltado = useResaltado(valor, datos);
  const Tag = bloque ? "div" : "span";
  return <Tag className={resaltado ? "cambio-resaltado" : undefined}>{children}</Tag>;
}
