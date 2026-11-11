import { useQuery } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

// ¿Ese email ya es de una cuenta? Solo consulta con un email completo (vacío = no consulta).
export function useCuentaPorEmail(email: string) {
  return useQuery({ queryKey: ["usuarios", "por-email", email], queryFn: () => usuarioService.porEmail(email), enabled: email !== "" });
}
