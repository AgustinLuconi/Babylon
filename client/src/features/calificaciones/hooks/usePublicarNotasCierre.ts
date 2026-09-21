import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";
import type { NotaCierre } from "../types";

export function usePublicarNotasCierre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notaCierreIds: string[]): Promise<NotaCierre[]> =>
      Promise.all(notaCierreIds.map((id) => calificacionService.publicarNotaCierre(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calificaciones"] });
    },
  });
}
