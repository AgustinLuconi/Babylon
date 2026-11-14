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

export interface DecisionTexto {
  destino: string;
  excepciones: Record<string, string>;
}

// Al desmarcar un curso para copiar, las decisiones que mandaban alumnos a "su copia" dejan de tener sentido: el destino del
// curso vuelve a quedar sin decidir y las excepciones que apuntaban a esa copia se quitan.
export function sinCopiasQueNoEstan<D extends DecisionTexto>(decisiones: Record<string, D>, copiar: string[]): Record<string, D> {
  const apuntaAUnaCopiaQueNoEsta = (valor: string) => valor.startsWith("copia:") && !copiar.includes(valor.slice(6));
  return Object.fromEntries(
    Object.entries(decisiones).map(([cursoId, d]) => [
      cursoId,
      {
        ...d,
        destino: apuntaAUnaCopiaQueNoEsta(d.destino) ? "" : d.destino,
        excepciones: Object.fromEntries(Object.entries(d.excepciones).filter(([, valor]) => !apuntaAUnaCopiaQueNoEsta(valor))),
      },
    ]),
  );
}

// El cierre (activar el ciclo nuevo y bloquear el viejo) viene marcado solo si el año del origen ya terminó: antes, bloquear el
// origen dejaría a los profesores sin poder cerrar sus notas.
export function cierreInicial(anioEnCurso: boolean): { activarDestino: boolean; bloquearOrigen: boolean } {
  return { activarDestino: !anioEnCurso, bloquearOrigen: !anioEnCurso };
}
