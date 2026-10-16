import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function useMarcarLeida() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificacionService.marcarLeida,
    // Campana e historial (comparten el prefijo de la clave).
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}
