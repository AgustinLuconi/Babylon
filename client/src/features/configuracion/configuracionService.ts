import { apiClient } from "@/core/lib/apiClient";
import type { Configuracion } from "./types";

export const configuracionService = {
  obtener: () => apiClient.get<Configuracion>("/api/configuracion"),
  actualizar: (valorCuota: number) => apiClient.patch<Configuracion>("/api/configuracion", { valorCuota }),
};
