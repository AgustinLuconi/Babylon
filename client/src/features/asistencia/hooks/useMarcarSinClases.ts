import { useMutation, useQueryClient } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

export function useMarcarSinClases() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: asistenciaService.marcarSinClases,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asistencia"] }),
  });
}
