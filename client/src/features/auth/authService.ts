import { apiClient } from "@/core/lib/apiClient";
import type { CredencialesInput, ResultadoAutenticacion } from "./types";

export const authService = {
  // Cierra la sesión en el servidor; si falla (por ejemplo, ya había vencido) el cierre local igual se hace.
  logout: () => apiClient.post<void>("/api/auth/logout"),
  login: (credenciales: CredencialesInput) =>
    apiClient.post<ResultadoAutenticacion>("/api/auth/login", credenciales),
};
