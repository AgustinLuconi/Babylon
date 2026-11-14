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

// Las observaciones no guardan de qué curso son: se reparten por el año en que se escribieron (hora local). Cada curso del
// historial se queda con las de su año; las escritas en un año sin curso en el historial (por ejemplo, el año real antes de
// que empiece el ciclo siguiente) se muestran en el curso actual.
export function filtrarObservaciones<T extends { fecha: string }>(
  items: T[] | undefined,
  filas: FilaDelHistorial[] | undefined,
  cursoId: string | null,
): T[] | undefined {
  const elegida = filas?.find((f) => f.cursoId === cursoId);
  if (!items || !filas || !elegida) return items;
  const anios = new Set(filas.map((f) => f.anio));
  const esElActual = elegida.cursoId === cursoDeLaVista(filas, null);
  return items.filter((i) => {
    const anio = new Date(i.fecha).getFullYear();
    return anio === elegida.anio || (esElActual && !anios.has(anio));
  });
}
