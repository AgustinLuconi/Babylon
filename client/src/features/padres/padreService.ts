import { apiClient } from "@/core/lib/apiClient";
import type { ActualizarPadreInput, CrearPadreInput, Padre } from "./types";

export const padreService = {
  listar: () => apiClient.get<Padre[]>("/api/padres"),
  crear: (datos: CrearPadreInput) => apiClient.post<Padre>("/api/padres", datos),
  actualizar: (id: string, datos: ActualizarPadreInput) => apiClient.patch<Padre>(`/api/padres/${id}`, datos),
};
