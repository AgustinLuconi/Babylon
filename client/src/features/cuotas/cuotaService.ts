import { apiClient } from "@/core/lib/apiClient";
import type { Cuota, Pago, RegistrarPagoInput } from "./types";

export const cuotaService = {
  listarPorAlumno: (alumnoId: string) => apiClient.get<Cuota[]>(`/api/cuotas/alumnos/${alumnoId}`),
  listarTodas: () => apiClient.get<Cuota[]>("/api/cuotas"),
  listarPagos: () => apiClient.get<Pago[]>("/api/cuotas/pagos"),
  registrarPago: (datos: RegistrarPagoInput) => apiClient.post<Pago[]>("/api/cuotas/pagos", datos),
};
