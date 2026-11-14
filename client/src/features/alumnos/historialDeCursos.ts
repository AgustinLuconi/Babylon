// Qué curso de su historial se está mirando en el legajo y en el panel de la familia, y cómo se separan por curso las notas,
// los cierres y la asistencia (el servidor entrega todo lo del alumno, de todos los años).
export interface FilaDelHistorial {
  cursoId: string;
  anio: number;
  actual: boolean;
}

// El elegido (si está en el historial); si no, el curso actual; si no, el del año más nuevo. Sin historial: null (no se filtra).
export function cursoDeLaVista(filas: FilaDelHistorial[] | undefined, elegido: string | null): string | null {
  if (!filas || filas.length === 0) return null;
  if (elegido && filas.some((f) => f.cursoId === elegido)) return elegido;
  return filas.find((f) => f.actual)?.cursoId ?? [...filas].sort((a, b) => b.anio - a.anio)[0].cursoId;
}

export function filtrarPorCurso<T extends { cursoId: string }>(items: T[] | undefined, cursoId: string | null): T[] | undefined {
  if (!items || cursoId === null) return items;
  return items.filter((i) => i.cursoId === cursoId);
}

// Las observaciones no guardan de qué curso son: cada curso del historial muestra las escritas en su año (hora local), que es el
// año de su ciclo. Una escrita en un año que no es el de ningún curso del historial no se muestra en ninguno.
export function filtrarObservaciones<T extends { fecha: string }>(
  items: T[] | undefined,
  filas: FilaDelHistorial[] | undefined,
  cursoId: string | null,
): T[] | undefined {
  const elegida = filas?.find((f) => f.cursoId === cursoId);
  if (!items || !elegida) return items;
  return items.filter((i) => new Date(i.fecha).getFullYear() === elegida.anio);
}
