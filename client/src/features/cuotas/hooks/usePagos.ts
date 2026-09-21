import { useQuery } from "@tanstack/react-query";
import { cuotaService } from "../cuotaService";

export function usePagos() {
  return useQuery({
    queryKey: ["cuotas", "pagos"],
    queryFn: cuotaService.listarPagos,
  });
}
