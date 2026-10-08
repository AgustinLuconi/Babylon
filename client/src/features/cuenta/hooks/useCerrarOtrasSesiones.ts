import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCerrarOtrasSesiones() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cerrarOtras,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
