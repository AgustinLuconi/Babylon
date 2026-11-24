import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useEliminarPausa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cicloId, pausaId }: { cicloId: string; pausaId: string }) => cicloService.eliminarPausa(cicloId, pausaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ciclos"] }),
  });
}
