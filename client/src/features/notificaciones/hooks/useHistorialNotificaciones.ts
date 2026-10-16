import { useInfiniteQuery } from "@tanstack/react-query";
import { notificacionService } from "../notificacionService";
import type { FiltroHistorial } from "../types";

export function useHistorialNotificaciones(filtro: FiltroHistorial) {
  return useInfiniteQuery({
    queryKey: ["notificaciones", "historial", filtro],
    queryFn: ({ pageParam }) => notificacionService.historial(filtro, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.siguiente ?? undefined,
  });
}
