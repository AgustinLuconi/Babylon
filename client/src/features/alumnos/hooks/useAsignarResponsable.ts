import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ResponsableElegido } from "@/features/padres/types";
import { alumnoService } from "../alumnoService";

// Asigna o cambia el responsable de un alumno (o su vínculo, o lo pasa a ser responsable de sí mismo).
export function useAsignarResponsable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, responsable }: { id: string; responsable: ResponsableElegido }) => alumnoService.asignarResponsable(id, responsable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      queryClient.invalidateQueries({ queryKey: ["padres"] });
      queryClient.invalidateQueries({ queryKey: ["sin-cuenta"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
