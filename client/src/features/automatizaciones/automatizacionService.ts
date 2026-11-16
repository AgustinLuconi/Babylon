import { apiClient } from "@/core/lib/apiClient";
import type { ActualizarAutomatizacionInput, HistorialDeAlertas, ReglaConEstado, ReglaId } from "./types";

export const automatizacionService = {
  listar: () => apiClient.get<ReglaConEstado[]>("/api/automatizaciones"),
  actualizar: (regla: ReglaId, cambios: ActualizarAutomatizacionInput) => apiClient.patch<ReglaConEstado>(`/api/automatizaciones/${regla}`, cambios),
  historial: (regla: ReglaId, pagina: number) => apiClient.get<HistorialDeAlertas>(`/api/automatizaciones/${regla}/alertas?pagina=${pagina}`),
};
