import { apiClient } from "@/core/lib/apiClient";
import type { ActualizarAlumnoInput, Alumno, HijoConCurso, NuevoAlumnoInput } from "./types";

export const alumnoService = {
  listar: (cicloId?: string) => apiClient.get<Alumno[]>(`/api/alumnos${cicloId ? `?cicloId=${cicloId}` : ""}`),
  misHijos: () => apiClient.get<HijoConCurso[]>("/api/alumnos/mios"),
  inscribir: (datos: NuevoAlumnoInput) => apiClient.post<Alumno>("/api/alumnos", datos),
  actualizar: (id: string, datos: ActualizarAlumnoInput) => apiClient.patch<Alumno>(`/api/alumnos/${id}`, datos),
};
