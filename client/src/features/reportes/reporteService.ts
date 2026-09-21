import { apiClient } from "@/core/lib/apiClient";
import type { ReporteAlumnoResumen, ResumenDashboard } from "./types";

export const reporteService = {
  obtenerResumenDashboard: (cicloId?: string) =>
    apiClient.get<ResumenDashboard>(`/api/reportes/dashboard${cicloId ? `?cicloId=${cicloId}` : ""}`),
  listarReporteAlumnos: (cicloId?: string) =>
    apiClient.get<ReporteAlumnoResumen[]>(`/api/reportes/alumnos${cicloId ? `?cicloId=${cicloId}` : ""}`),
};
