import { useQuery } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: usuarioService.listar,
  });
}
