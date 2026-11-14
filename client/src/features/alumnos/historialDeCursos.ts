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
