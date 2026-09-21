import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";
import type { CargarCalificacionesInput } from "../types";

export function useCargarCalificaciones(evaluacionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datos: CargarCalificacionesInput) => calificacionService.cargarCalificaciones(evaluacionId, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calificaciones", evaluacionId] });
    },
  });
}
