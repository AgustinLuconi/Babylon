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
    },
  });
}
