import type { DestinoDeAlumnos } from "./types";

// Los selectores del asistente guardan el destino como texto: "" (sin decidir), "curso:<id>", "copia:<id>",
// "egresan" o "no-continuan".
export function valorDeDestino(destino?: DestinoDeAlumnos): string {
  if (!destino) return "";
  if (destino.tipo === "curso") return `curso:${destino.cursoId}`;
  if (destino.tipo === "copia") return `copia:${destino.copiaDe}`;
  return destino.tipo;
}

export function destinoDeValor(valor: string): DestinoDeAlumnos | undefined {
  if (valor === "egresan" || valor === "no-continuan") return { tipo: valor };
  if (valor.startsWith("curso:")) return { tipo: "curso", cursoId: valor.slice(6) };
  if (valor.startsWith("copia:")) return { tipo: "copia", copiaDe: valor.slice(6) };
  return undefined;
}
