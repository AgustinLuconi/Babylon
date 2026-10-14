import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvitarInput, ResultadoEnvio } from "../types";
import { usuarioService } from "../usuarioService";
import { MOTIVO_CORTE, TAMANO_TANDA, invalidarAccesos } from "./accesos";

export function useInvitar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ padreIds, profesorIds }: InvitarInput) => {
      const personas = [...padreIds.map((id) => ({ rol: "padre" as const, id })), ...profesorIds.map((id) => ({ rol: "profesor" as const, id }))];
      const resultados: ResultadoEnvio[] = [];
      for (let i = 0; i < personas.length; i += TAMANO_TANDA) {
        const tanda = personas.slice(i, i + TAMANO_TANDA);
        try {
          resultados.push(
            ...(await usuarioService.invitar({
              padreIds: tanda.filter((p) => p.rol === "padre").map((p) => p.id),
              profesorIds: tanda.filter((p) => p.rol === "profesor").map((p) => p.id),
            })),
          );
        } catch {
          // Lo de las tandas anteriores ya salió y no se pierde: el resto se informa como no enviado.
          resultados.push(...personas.slice(i).map((p) => ({ id: p.id, nombre: "", resultado: "no-enviada" as const, motivo: MOTIVO_CORTE })));
          break;
        }
      }
      return resultados;
    },
    onSettled: () => invalidarAccesos(queryClient),
  });
}
