import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useDesbloquearCiclo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cicloService.desbloquear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos"] });
    },
  });
}
