import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";
import type { ActualizarCuentaInput } from "../types";

export function useActualizarCuenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarCuentaInput }) => usuarioService.actualizarCuenta(id, datos),
    onSuccess: () => {
      for (const clave of ["usuarios", "sin-cuenta", "padres", "profesores"]) void queryClient.invalidateQueries({ queryKey: [clave] });
    },
  });
}
