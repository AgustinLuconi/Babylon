import { apiClient } from "@/core/lib/apiClient";
import type { Ciclo, CrearCicloInput, PaseDeAnioInput, ResumenPaseDeAnio, VistaPreviaPaseDeAnio } from "./types";

export const cicloService = {
  listar: () => apiClient.get<Ciclo[]>("/api/ciclos"),
  crear: (datos: CrearCicloInput) => apiClient.post<Ciclo>("/api/ciclos", datos),
  marcarActivo: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/activar`),
  bloquear: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/bloquear`),
  vistaPreviaPaseDeAnio: (datos: PaseDeAnioInput) => apiClient.post<VistaPreviaPaseDeAnio>("/api/ciclos/pase-de-anio/vista-previa", datos),
  confirmarPaseDeAnio: (datos: PaseDeAnioInput) => apiClient.post<ResumenPaseDeAnio>("/api/ciclos/pase-de-anio/confirmar", datos),
  desbloquear: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/desbloquear`),
};
