import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";
import type { PausaInput } from "../types";

// Crea una pausa, o la edita si viene `pausaId`.
export function useGuardarPausa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cicloId, pausaId, datos }: { cicloId: string; pausaId?: string; datos: PausaInput }) =>
      pausaId ? cicloService.editarPausa(cicloId, pausaId, datos) : cicloService.agregarPausa(cicloId, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ciclos"] }),
  });
}
