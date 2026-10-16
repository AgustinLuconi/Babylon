import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

export function usePreferenciasNotificaciones() {
  return useQuery({ queryKey: ["preferencias-notificaciones"], queryFn: notificacionService.preferencias });
}
