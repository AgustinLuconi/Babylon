import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useCrearCiclo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cicloService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos"] });
    },
  });
}
