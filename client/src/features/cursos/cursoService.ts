import { apiClient } from "@/core/lib/apiClient";
import type { Alumno } from "@/features/alumnos/types";
import type { ActualizarCursoInput, CrearCursoInput, Curso, Horario } from "./types";

export const cursoService = {
  listar: () => apiClient.get<Curso[]>("/api/cursos"),
  listarAlumnos: (cursoId: string) => apiClient.get<Alumno[]>(`/api/cursos/${cursoId}/alumnos`),
  listarHorarios: () => apiClient.get<Horario[]>("/api/cursos/horarios"),
  crear: (datos: CrearCursoInput) => apiClient.post<Curso>("/api/cursos", datos),
  actualizar: (id: string, datos: ActualizarCursoInput) => apiClient.patch<Curso>(`/api/cursos/${id}`, datos),
};
