import { useQuery } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useCiclos() {
  return useQuery({
    queryKey: ["ciclos"],
    queryFn: cicloService.listar,
  });
}
