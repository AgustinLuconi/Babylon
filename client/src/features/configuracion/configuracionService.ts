import { apiClient } from "@/core/lib/apiClient";
import type { ActualizarConfiguracionInput, Configuracion } from "./types";

export const configuracionService = {
  obtener: () => apiClient.get<Configuracion>("/api/configuracion"),
  actualizar: (datos: ActualizarConfiguracionInput) => apiClient.patch<Configuracion>("/api/configuracion", datos),
};
