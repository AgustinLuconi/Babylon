import { useQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";

const CINCO_MINUTOS = 5 * 60 * 1000;

export function useNotificaciones() {
  return useQuery({
    queryKey: ["notificaciones"],
    queryFn: notificacionService.listar,
    refetchInterval: CINCO_MINUTOS,
    refetchOnWindowFocus: true,
  });
}
