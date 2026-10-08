import { apiClient } from "@/core/lib/apiClient";
import type { CambiarContrasenaInput, SesionActiva } from "./types";

export const cuentaService = {
  cambiarContrasena: (datos: CambiarContrasenaInput) => apiClient.post<void>("/api/auth/cambiar-contrasena", datos),
  // Abrir la lista cuenta como usar esta sesión (el servidor registra el último uso).
  listarSesiones: () => apiClient.get<SesionActiva[]>("/api/auth/sesiones"),
  cerrarSesion: (id: string) => apiClient.delete<void>(`/api/auth/sesiones/${id}`),
  cerrarOtras: () => apiClient.post<{ cerradas: number }>("/api/auth/sesiones/cerrar-otras"),
};
