import { useQuery } from "@tanstack/react-query";
import { cuotaService } from "../cuotaService";

export function useCuotas() {
  return useQuery({
    queryKey: ["cuotas"],
    queryFn: cuotaService.listarTodas,
  });
}
