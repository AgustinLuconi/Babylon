import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configuracionService } from "../configuracionService";

export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (valorCuota: number) => configuracionService.actualizar(valorCuota),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracion"] }),
  });
}
