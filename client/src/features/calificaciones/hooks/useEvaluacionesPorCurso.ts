import { useQuery } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function useEvaluacionesPorCurso(cursoId: string | undefined) {
  return useQuery({
    queryKey: ["evaluaciones", cursoId],
    queryFn: () => calificacionService.listarEvaluacionesPorCurso(cursoId as string),
    enabled: cursoId !== undefined,
  });
}
