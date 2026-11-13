import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActualizarPadreInput } from "../types";
import { padreService } from "../padreService";

export function useActualizarPadre() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarPadreInput }) => padreService.actualizar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["padres"] });
      // Corregir el email o el nombre de un responsable cambia lo que muestra "Sin cuenta" y la cuenta vinculada.
      queryClient.invalidateQueries({ queryKey: ["sin-cuenta"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
