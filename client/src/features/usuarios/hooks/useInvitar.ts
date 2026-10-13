import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvitarInput, ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useInvitar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ padreIds, profesorIds }: InvitarInput) => {
      const personas = [...padreIds.map((id) => ({ rol: "padre" as const, id })), ...profesorIds.map((id) => ({ rol: "profesor" as const, id }))];
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < personas.length; i += TAMANO_TANDA) {
        const tanda = personas.slice(i, i + TAMANO_TANDA);
        resultados.push(
          ...(await usuarioService.invitar({
            padreIds: tanda.filter((p) => p.rol === "padre").map((p) => p.id),
            profesorIds: tanda.filter((p) => p.rol === "profesor").map((p) => p.id),
          })),
        );
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
