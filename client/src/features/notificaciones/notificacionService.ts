import { apiClient } from "@/core/lib/apiClient";
import type { Notificacion } from "./types";

export const notificacionService = {
  listar: () => apiClient.get<Notificacion[]>("/api/notificaciones"),
};
