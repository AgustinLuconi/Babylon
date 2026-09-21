import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function usePublicarEvaluacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calificacionService.publicarEvaluacion,
    onSuccess: (evaluacion) => {
      queryClient.invalidateQueries({ queryKey: ["evaluaciones", evaluacion.cursoId] });
    },
  });
}
