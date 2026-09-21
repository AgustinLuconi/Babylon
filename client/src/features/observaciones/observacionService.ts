import { apiClient } from "@/core/lib/apiClient";
import type {
  CategoriaPersonalizada,
  CrearCategoriaPersonalizadaInput,
  CrearObservacionInput,
  Observacion,
  ObservacionConEmisor,
} from "./types";

export const observacionService = {
  listarPorAlumno: (alumnoId: string) =>
    apiClient.get<ObservacionConEmisor[]>(`/api/observaciones/alumnos/${alumnoId}`),
  crear: (datos: CrearObservacionInput) => apiClient.post<Observacion>("/api/observaciones", datos),
  listarCategoriasPersonalizadas: (cursoId: string) =>
    apiClient.get<CategoriaPersonalizada[]>(`/api/observaciones/cursos/${cursoId}/categorias`),
  crearCategoriaPersonalizada: (datos: CrearCategoriaPersonalizadaInput) =>
    apiClient.post<CategoriaPersonalizada>("/api/observaciones/categorias", datos),
};
