import { fechaHoraEnArgentina } from "../../core/fechas";

export const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// "15/10/2026": el día tal como se ve en Argentina.
export function fechaCorta(instante: Date): string {
  const { dia, mes, anio } = fechaHoraEnArgentina(instante);
  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`;
}
