import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useReenviarInvitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (usuarioIds: string[]) => {
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < usuarioIds.length; i += TAMANO_TANDA) {
        resultados.push(...(await usuarioService.reenviar(usuarioIds.slice(i, i + TAMANO_TANDA))));
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
