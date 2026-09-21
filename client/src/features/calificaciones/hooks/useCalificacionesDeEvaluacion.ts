import { useQuery } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function useCalificacionesDeEvaluacion(evaluacionId: string | undefined) {
  return useQuery({
    queryKey: ["calificaciones", evaluacionId],
    queryFn: () => calificacionService.listarCalificacionesDeEvaluacion(evaluacionId as string),
    enabled: evaluacionId !== undefined,
  });
}
