import { apiClient } from "@/core/lib/apiClient";
import type { Ciclo, CrearCicloInput, EditarFechasInput, PaseDeAnioInput, PausaDelCiclo, PausaInput, ResumenPaseDeAnio, VistaPreviaPaseDeAnio } from "./types";

export const cicloService = {
  listar: () => apiClient.get<Ciclo[]>("/api/ciclos"),
  crear: (datos: CrearCicloInput) => apiClient.post<Ciclo>("/api/ciclos", datos),
  marcarActivo: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/activar`),
  bloquear: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/bloquear`),
  vistaPreviaPaseDeAnio: (datos: PaseDeAnioInput) => apiClient.post<VistaPreviaPaseDeAnio>("/api/ciclos/pase-de-anio/vista-previa", datos),
  confirmarPaseDeAnio: (datos: PaseDeAnioInput) => apiClient.post<ResumenPaseDeAnio>("/api/ciclos/pase-de-anio/confirmar", datos),
  editarFechas: (id: string, datos: EditarFechasInput) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/fechas`, datos),
  agregarPausa: (cicloId: string, datos: PausaInput) => apiClient.post<PausaDelCiclo>(`/api/ciclos/${cicloId}/pausas`, datos),
  editarPausa: (cicloId: string, pausaId: string, datos: Partial<PausaInput>) => apiClient.patch<PausaDelCiclo>(`/api/ciclos/${cicloId}/pausas/${pausaId}`, datos),
  eliminarPausa: (cicloId: string, pausaId: string) => apiClient.delete<void>(`/api/ciclos/${cicloId}/pausas/${pausaId}`),
  desbloquear: (id: string) => apiClient.patch<Ciclo>(`/api/ciclos/${id}/desbloquear`),
};
