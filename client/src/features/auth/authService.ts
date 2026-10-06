import { apiClient } from "@/core/lib/apiClient";
import type { CredencialesInput, ResultadoAutenticacion } from "./types";

export const authService = {
  login: (credenciales: CredencialesInput) =>
    apiClient.post<ResultadoAutenticacion>("/api/auth/login", credenciales),
  solicitarRecuperacion: (email: string) =>
    apiClient.post<{ mensaje: string }>("/api/auth/olvide-contrasena", { email }),
  restablecerContrasena: (token: string, password: string) =>
    apiClient.post<void>("/api/auth/restablecer-contrasena", { token, password }),
};
