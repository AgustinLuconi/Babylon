import { useQuery } from "@tanstack/react-query";
import { automatizacionService } from "../automatizacionService";

export function useAutomatizaciones() {
  return useQuery({ queryKey: ["automatizaciones"], queryFn: automatizacionService.listar });
}
