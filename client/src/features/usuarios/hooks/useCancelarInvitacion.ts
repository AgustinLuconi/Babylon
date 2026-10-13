import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usuarioService } from "../usuarioService";
import { invalidarAccesos } from "./accesos";

export function useCancelarInvitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usuarioService.cancelarInvitacion,
    onSettled: () => invalidarAccesos(queryClient),
  });
}
