import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cerrarSesion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
