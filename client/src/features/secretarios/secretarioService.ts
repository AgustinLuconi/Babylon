import { apiClient } from "@/core/lib/apiClient";
import type { CrearSecretarioInput, Secretario } from "./types";

export const secretarioService = {
  crear: (datos: CrearSecretarioInput) => apiClient.post<Secretario>("/api/auth/secretarios", datos),
};
