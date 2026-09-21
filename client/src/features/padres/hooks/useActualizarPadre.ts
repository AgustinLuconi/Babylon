import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActualizarPadreInput } from "../types";
import { padreService } from "../padreService";

export function useActualizarPadre() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarPadreInput }) => padreService.actualizar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["padres"] });
    },
  });
}
