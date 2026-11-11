import type { Mensaje } from "./types";

// Cuánto después de enviarlo se puede corregir o eliminar un mensaje (igual al del servidor, que es quien lo controla).
// El plazo cuenta desde el envío: corregirlo no lo renueva.
export const MINUTOS_PARA_CORREGIR = 15;

// ¿Quien mira puede corregir o eliminar este mensaje ahora? La familia solo los suyos; cualquiera del instituto, los del
// instituto (administración o secretaría, sin importar quién lo escribió). Uno eliminado ya no se toca.
export function puedeCorregir(mensaje: Mensaje, soyInstituto: boolean, ahora: Date = new Date()): boolean {
  if (mensaje.eliminadoEn) return false;
  if ((mensaje.rolEmisor !== "padre") !== soyInstituto) return false;
  return ahora.getTime() - new Date(mensaje.fecha).getTime() <= MINUTOS_PARA_CORREGIR * 60_000;
}
