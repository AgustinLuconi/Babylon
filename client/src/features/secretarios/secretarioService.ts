import { apiClient } from "@/core/lib/apiClient";
import type { CrearSecretarioInput, SecretarioCreado } from "./types";

export const secretarioService = {
  crear: (datos: CrearSecretarioInput) => apiClient.post<SecretarioCreado>("/api/auth/secretarios", datos),
};
