import { useQuery } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useSesiones() {
  return useQuery({ queryKey: ["sesiones"], queryFn: cuentaService.listarSesiones });
}
