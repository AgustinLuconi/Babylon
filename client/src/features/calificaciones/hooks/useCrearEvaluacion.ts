import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function useCrearEvaluacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: calificacionService.crearEvaluacion,
    onSuccess: (evaluacion) => {
      queryClient.invalidateQueries({ queryKey: ["evaluaciones", evaluacion.cursoId] });
    },
  });
}
