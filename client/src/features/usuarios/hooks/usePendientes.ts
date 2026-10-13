import { useQuery } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function usePendientes() {
  return useQuery({ queryKey: ["pendientes"], queryFn: usuarioService.pendientes });
}
