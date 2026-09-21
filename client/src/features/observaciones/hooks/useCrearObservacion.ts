import { useMutation, useQueryClient } from "@tanstack/react-query";
import { observacionService } from "../observacionService";

export function useCrearObservacion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: observacionService.crear,
    onSuccess: (observacion) => {
      queryClient.invalidateQueries({ queryKey: ["observaciones", observacion.alumnoId] });
    },
  });
}
