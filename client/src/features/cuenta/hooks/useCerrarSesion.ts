import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCerrarSesion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cerrarSesion,
    // También si falla (ej. 404 porque ya se cerró en otro dispositivo): la lista mostrada quedó desactualizada.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
