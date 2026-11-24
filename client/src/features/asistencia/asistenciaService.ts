import { apiClient } from "@/core/lib/apiClient";
import type { Asistencia, ClaseSinDictar, MarcarSinClasesInput, RegistrarAsistenciaMasivaInput } from "./types";

export const asistenciaService = {
  registrarMasiva: (datos: RegistrarAsistenciaMasivaInput) =>
    apiClient.post<Asistencia[]>("/api/asistencia/masiva", datos),
  listarPorAlumno: (alumnoId: string) => apiClient.get<Asistencia[]>(`/api/asistencia/alumnos/${alumnoId}`),
  marcarSinClases: (datos: MarcarSinClasesInput) => apiClient.post<ClaseSinDictar>("/api/asistencia/sin-clases", datos),
  quitarSinClases: (cursoId: string, fecha: string) => apiClient.delete<void>(`/api/asistencia/sin-clases/${cursoId}/${fecha}`),
  sinClasesDelCurso: (cursoId: string) => apiClient.get<{ fecha: string; motivo?: string }[]>(`/api/asistencia/cursos/${cursoId}/sin-clases`),
  sinClasesDelAlumno: (alumnoId: string) => apiClient.get<ClaseSinDictar[]>(`/api/asistencia/alumnos/${alumnoId}/sin-clases`),
};
