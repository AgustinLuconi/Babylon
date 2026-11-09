import { apiClient } from "@/core/lib/apiClient";
import type { ResponsableElegido } from "@/features/padres/types";
import type { ActualizarAlumnoInput, Alumno, AlumnoInscripto, HijoConCurso, NuevoAlumnoInput } from "./types";

export const alumnoService = {
  listar: (cicloId?: string) => apiClient.get<Alumno[]>(`/api/alumnos${cicloId ? `?cicloId=${cicloId}` : ""}`),
  misHijos: () => apiClient.get<HijoConCurso[]>("/api/alumnos/mios"),
  inscribir: (datos: NuevoAlumnoInput) => apiClient.post<AlumnoInscripto>("/api/alumnos", datos),
  asignarResponsable: (id: string, responsable: ResponsableElegido) => apiClient.put<AlumnoInscripto>(`/api/alumnos/${id}/responsable`, responsable),
  actualizar: (id: string, datos: ActualizarAlumnoInput) => apiClient.patch<Alumno>(`/api/alumnos/${id}`, datos),
};
