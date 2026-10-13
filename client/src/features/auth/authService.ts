import { apiClient } from "@/core/lib/apiClient";
import type { CredencialesInput, ResultadoAutenticacion } from "./types";

export const authService = {
  // Cierra la sesión en el servidor; si falla (por ejemplo, ya había vencido) el cierre local igual se hace.
  logout: () => apiClient.post<void>("/api/auth/logout"),
  login: (credenciales: CredencialesInput) =>
    apiClient.post<ResultadoAutenticacion>("/api/auth/login", credenciales),
  solicitarRecuperacion: (email: string) =>
    apiClient.post<{ mensaje: string }>("/api/auth/olvide-contrasena", { email }),
  consultarInvitacion: (token: string) =>
    apiClient.post<{ nombre: string; email: string }>("/api/auth/activar-cuenta/consultar", { token }),
  activarCuenta: (token: string, password: string) => apiClient.post<void>("/api/auth/activar-cuenta", { token, password }),
  verificarEmail: (token: string) => apiClient.post<void>("/api/auth/verificar-email", { token }),
  restablecerContrasena: (token: string, password: string) =>
    apiClient.post<void>("/api/auth/restablecer-contrasena", { token, password }),
};
