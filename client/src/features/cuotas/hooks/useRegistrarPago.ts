import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuotaService } from "../cuotaService";

export function useRegistrarPago() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cuotaService.registrarPago,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuotas"] });
    },
  });
}
