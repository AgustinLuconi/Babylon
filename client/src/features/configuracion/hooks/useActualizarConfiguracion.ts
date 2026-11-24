import { useMutation, useQueryClient } from "@tanstack/react-query";
import { configuracionService } from "../configuracionService";
import type { ActualizarConfiguracionInput } from "../types";

export function useActualizarConfiguracion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (datos: ActualizarConfiguracionInput) => configuracionService.actualizar(datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracion"] }),
  });
}
