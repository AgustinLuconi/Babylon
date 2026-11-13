import { apiClient } from "@/core/lib/apiClient";
import type { ResponsableElegido } from "@/features/padres/types";
import type { DatoFaltante } from "./datosFaltantes";
import type { ActualizarAlumnoInput, Alumno, HijoConCurso, NuevoAlumnoInput } from "./types";

export const alumnoService = {
  listar: (cicloId?: string) => apiClient.get<Alumno[]>(`/api/alumnos${cicloId ? `?cicloId=${cicloId}` : ""}`),
  incompletos: () => apiClient.get<Record<string, DatoFaltante[]>>("/api/alumnos/incompletos"),
  misHijos: () => apiClient.get<HijoConCurso[]>("/api/alumnos/mios"),
  inscribir: (datos: NuevoAlumnoInput) => apiClient.post<Alumno>("/api/alumnos", datos),
  asignarResponsable: (id: string, responsable: ResponsableElegido) => apiClient.put<Alumno>(`/api/alumnos/${id}/responsable`, responsable),
  actualizar: (id: string, datos: ActualizarAlumnoInput) => apiClient.patch<Alumno>(`/api/alumnos/${id}`, datos),
};
