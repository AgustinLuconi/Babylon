import { useCallback, useEffect, useState } from "react";
import { cursoDeLaVista, filtrarPorCurso } from "../historialDeCursos";
import { useHistorialDeCursos } from "./useHistorialDeCursos";

// El curso que se está mirando (por defecto el actual) y cómo filtrar por él las notas, los cierres y la asistencia.
export function useVistaDeCurso(alumnoId: string | undefined) {
  const { data: filas } = useHistorialDeCursos(alumnoId);
  const [elegido, setElegido] = useState<string | null>(null);
  useEffect(() => setElegido(null), [alumnoId]);
  const cursoId = cursoDeLaVista(filas, elegido);
  const filtrar = useCallback(<T extends { cursoId: string }>(items: T[] | undefined) => filtrarPorCurso(items, cursoId), [cursoId]);
  return { filas, cursoId, elegir: setElegido, filtrar };
}
