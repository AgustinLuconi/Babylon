import { useCallback, useEffect, useState } from "react";
import { cursoDeLaVista, filtrarObservaciones, filtrarPorCurso } from "../historialDeCursos";
import { useHistorialDeCursos } from "./useHistorialDeCursos";

// El curso que se está mirando (por defecto el actual) y cómo filtrar por él las notas, los cierres y la asistencia.
export function useVistaDeCurso(alumnoId: string | undefined) {
  const { data: filas } = useHistorialDeCursos(alumnoId);
  const [elegido, setElegido] = useState<string | null>(null);
  useEffect(() => setElegido(null), [alumnoId]);
  const cursoId = cursoDeLaVista(filas, elegido);
  const filtrar = useCallback(<T extends { cursoId: string }>(items: T[] | undefined) => filtrarPorCurso(items, cursoId), [cursoId]);
  // Las observaciones no guardan el curso: se reparten por el año en que se escribieron.
  const filtrarPorFecha = useCallback(<T extends { fecha: string }>(items: T[] | undefined) => filtrarObservaciones(items, filas, cursoId), [filas, cursoId]);
  return { filas, cursoId, elegir: setElegido, filtrar, filtrarPorFecha };
}
