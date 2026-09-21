import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";
import type { EstadoCuenta } from "../types";

export function useCambiarEstadoUsuario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoCuenta }) => usuarioService.cambiarEstado(id, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      // Desactivar la cuenta de un profesor también desactiva su ficha.
      queryClient.invalidateQueries({ queryKey: ["profesores"] });
    },
  });
}
