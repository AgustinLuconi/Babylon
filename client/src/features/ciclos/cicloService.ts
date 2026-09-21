import { apiClient } from "@/core/lib/apiClient";
import type { Ciclo, CrearCicloInput } from "./types";

export const cicloService = {
  listar: () => apiClient.get<Ciclo[]>("/api/ciclos"),
  crear: (datos: CrearCicloInput) => apiClient.post<Ciclo>("/api/ciclos", datos),
  marcarActivo: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/activar`),
};
