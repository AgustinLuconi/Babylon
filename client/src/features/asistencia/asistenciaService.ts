import { apiClient } from "@/core/lib/apiClient";
import type { Asistencia, RegistrarAsistenciaMasivaInput } from "./types";

export const asistenciaService = {
  registrarMasiva: (datos: RegistrarAsistenciaMasivaInput) =>
    apiClient.post<Asistencia[]>("/api/asistencia/masiva", datos),
  listarPorAlumno: (alumnoId: string) => apiClient.get<Asistencia[]>(`/api/asistencia/alumnos/${alumnoId}`),
};
