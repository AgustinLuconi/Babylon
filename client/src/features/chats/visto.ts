import type { Mensaje } from "./types";

const esDelInstituto = (m: Mensaje) => m.rolEmisor !== "padre";

// "Visto" va en un solo lugar: debajo del último mensaje de la conversación, si es de quien mira y el otro lado ya lo
// vio. Devuelve la hora en que se vio (ISO) o null. Cuando el otro responde, el último deja de ser propio y no hay Visto.
export function vistoDelUltimo(mensajes: Mensaje[], soyInstituto: boolean): string | null {
  const ultimo = mensajes.at(-1);
  if (!ultimo || esDelInstituto(ultimo) !== soyInstituto) return null;
  return ultimo.vistoEn;
}

// Los mensajes del otro lado que quien mira todavía no vio.
export function noLeidos(mensajes: Mensaje[], soyInstituto: boolean): Mensaje[] {
  return mensajes.filter((m) => esDelInstituto(m) !== soyInstituto && m.vistoEn === null);
}

// ¿Hay mensajes del otro lado que quien mira todavía no vio?
export function hayNoLeidos(mensajes: Mensaje[], soyInstituto: boolean): boolean {
  return noLeidos(mensajes, soyInstituto).length > 0;
}
