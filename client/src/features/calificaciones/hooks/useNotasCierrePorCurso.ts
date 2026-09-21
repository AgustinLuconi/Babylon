import { useQuery } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";
import type { PeriodoAcademico } from "../types";

export function useNotasCierrePorCurso(cursoId: string | undefined, periodo: PeriodoAcademico) {
  return useQuery({
    queryKey: ["calificaciones", "cursos", cursoId, "notas-cierre", periodo],
    queryFn: () => calificacionService.listarNotasCierrePorCurso(cursoId as string, periodo),
    enabled: cursoId !== undefined,
  });
}
