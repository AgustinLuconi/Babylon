import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { MOTIVO_CORTE, TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useReenviarInvitacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (usuarioIds: string[]) => {
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < usuarioIds.length; i += TAMANO_TANDA) {
        try {
          resultados.push(...(await usuarioService.reenviar(usuarioIds.slice(i, i + TAMANO_TANDA))));
        } catch {
          // Lo de las tandas anteriores ya salió y no se pierde: el resto se informa como no enviado.
          resultados.push(...usuarioIds.slice(i).map((id) => ({ id, nombre: "", resultado: "no-enviada" as const, motivo: MOTIVO_CORTE })));
          break;
        }
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
