import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profesorService } from "../profesorService";
import type { ActualizarProfesorInput } from "../types";

export function useActualizarProfesor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarProfesorInput }) => profesorService.actualizar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesores"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      // Activar o desactivar a un profesor sin cuenta lo agrega o lo saca de la lista de Pendientes.
      queryClient.invalidateQueries({ queryKey: ["pendientes"] });
    },
  });
}
