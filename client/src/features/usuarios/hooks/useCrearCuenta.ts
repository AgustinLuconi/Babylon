import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function useCrearCuenta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usuarioService.crearCuenta,
    onSuccess: () => {
      for (const clave of ["usuarios", "sin-cuenta", "padres", "profesores"]) void queryClient.invalidateQueries({ queryKey: [clave] });
    },
  });
}
