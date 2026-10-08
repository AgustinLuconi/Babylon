import { apiClient } from "@/core/lib/apiClient";
import type { CambiarContrasenaInput } from "./types";

export const cuentaService = {
  cambiarContrasena: (datos: CambiarContrasenaInput) => apiClient.post<void>("/api/auth/cambiar-contrasena", datos),
};
