import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";
import type { TipoNotificacion } from "../types";

export function useCambiarPreferencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tipo, activa }: { tipo: TipoNotificacion; activa: boolean }) => notificacionService.cambiarPreferencia(tipo, activa),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["preferencias-notificaciones"] });
      // Apagar borra los avisos de ese tipo; encender los vuelve a traer.
      void queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
    },
  });
}
