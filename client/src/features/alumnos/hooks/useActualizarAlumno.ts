import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActualizarAlumnoInput } from "../types";
import { alumnoService } from "../alumnoService";

export function useActualizarAlumno() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarAlumnoInput }) => alumnoService.actualizar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
    },
  });
}
