import { apiClient } from "@/core/lib/apiClient";
import type {
  CargarCalificacionesInput,
  CargarNotaCierreInput,
  Calificacion,
  CalificacionConEvaluacion,
  CrearEvaluacionInput,
  Evaluacion,
  NotaCierre,
} from "./types";

export const calificacionService = {
  listarEvaluacionesPorCurso: (cursoId: string) =>
    apiClient.get<Evaluacion[]>(`/api/calificaciones/cursos/${cursoId}/evaluaciones`),
  crearEvaluacion: (datos: CrearEvaluacionInput) => apiClient.post<Evaluacion>("/api/calificaciones/evaluaciones", datos),
  publicarEvaluacion: (evaluacionId: string) =>
    apiClient.patch<Evaluacion>(`/api/calificaciones/evaluaciones/${evaluacionId}/publicar`),
  listarCalificacionesDeEvaluacion: (evaluacionId: string) =>
    apiClient.get<Calificacion[]>(`/api/calificaciones/evaluaciones/${evaluacionId}/calificaciones`),
  cargarCalificaciones: (evaluacionId: string, datos: CargarCalificacionesInput) =>
    apiClient.post<Calificacion[]>(`/api/calificaciones/evaluaciones/${evaluacionId}/calificaciones`, datos),
  // Por lote: el curso entero en un solo pedido (todo o nada).
  cargarNotasCierre: (notas: CargarNotaCierreInput[]) =>
    apiClient.post<NotaCierre[]>("/api/calificaciones/notas-cierre", { notas }),
  publicarNotasCierre: (ids: string[]) => apiClient.post<NotaCierre[]>("/api/calificaciones/notas-cierre/publicar", { ids }),
  listarCalificacionesPorAlumno: (alumnoId: string) =>
    apiClient.get<CalificacionConEvaluacion[]>(`/api/calificaciones/alumnos/${alumnoId}`),
  listarNotasCierrePorAlumno: (alumnoId: string) =>
    apiClient.get<NotaCierre[]>(`/api/calificaciones/alumnos/${alumnoId}/notas-cierre`),
  listarNotasCierrePorCurso: (cursoId: string, periodo: string) =>
    apiClient.get<NotaCierre[]>(`/api/calificaciones/cursos/${cursoId}/notas-cierre?periodo=${periodo}`),
};
