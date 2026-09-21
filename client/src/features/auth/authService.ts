import { apiClient } from "@/core/lib/apiClient";
import type { CredencialesInput, ResultadoAutenticacion } from "./types";

export const authService = {
  login: (credenciales: CredencialesInput) =>
    apiClient.post<ResultadoAutenticacion>("/api/auth/login", credenciales),
};
