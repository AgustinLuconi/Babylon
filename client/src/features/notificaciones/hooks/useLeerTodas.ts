import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function useLeerTodas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificacionService.leerTodas,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}
