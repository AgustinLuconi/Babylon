import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useBloquearCiclo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cicloService.bloquear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos"] });
    },
  });
}
