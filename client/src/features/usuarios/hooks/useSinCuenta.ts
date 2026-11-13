import { useQuery } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function useSinCuenta() {
  return useQuery({ queryKey: ["sin-cuenta"], queryFn: usuarioService.sinCuenta });
}
