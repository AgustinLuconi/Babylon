import { useQuery } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useYo() {
  return useQuery({ queryKey: ["yo"], queryFn: cuentaService.yo });
}
