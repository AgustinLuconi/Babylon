import { apiClient } from "@/core/lib/apiClient";
import type { ActualizarProfesorInput, CrearProfesorInput, Profesor } from "./types";

export const profesorService = {
  listar: () => apiClient.get<Profesor[]>("/api/profesores"),
  crear: (datos: CrearProfesorInput) => apiClient.post<Profesor>("/api/profesores", datos),
  actualizar: (id: string, datos: ActualizarProfesorInput) => apiClient.patch<Profesor>(`/api/profesores/${id}`, datos),
};
