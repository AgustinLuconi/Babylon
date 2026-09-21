import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";

export function useCrearAdministrador() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: usuarioService.crearAdministrador,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
