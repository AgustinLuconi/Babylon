import { apiClient } from "@/core/lib/apiClient";
import type { Campana, FiltroHistorial, PaginaHistorial, Preferencia, TipoNotificacion } from "./types";

export const notificacionService = {
  campana: () => apiClient.get<Campana>("/api/notificaciones"),
  historial: (filtro: FiltroHistorial, despuesDe?: string) =>
    apiClient.get<PaginaHistorial>(
      `/api/notificaciones/historial?filtro=${filtro}${despuesDe ? `&despuesDe=${encodeURIComponent(despuesDe)}` : ""}`,
    ),
  marcarLeida: (id: string) => apiClient.post<void>(`/api/notificaciones/${encodeURIComponent(id)}/leida`),
  leerTodas: () => apiClient.post<{ marcadas: number }>("/api/notificaciones/leer-todas"),
  preferencias: () => apiClient.get<Preferencia[]>("/api/notificaciones/preferencias"),
  cambiarPreferencia: (tipo: TipoNotificacion, activa: boolean) =>
    apiClient.patch<void>(`/api/notificaciones/preferencias/${tipo}`, { activa }),
};
