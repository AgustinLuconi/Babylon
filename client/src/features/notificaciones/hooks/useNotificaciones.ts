import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

// La campana se actualiza sola con las señales en vivo (core/tiempoReal); al volver a la pestaña también se refresca.
export function useNotificaciones() {
  return useQuery({ queryKey: ["notificaciones"], queryFn: notificacionService.campana, refetchOnWindowFocus: true });
}
