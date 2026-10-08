import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useCambiarContrasena() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cuentaService.cambiarContrasena,
    // Cambiar la contraseña cierra las demás sesiones: la lista de sesiones activas queda desactualizada.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sesiones"] }),
  });
}
