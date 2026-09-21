import { useMutation, useQueryClient } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

export function useInscribirAlumno() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: alumnoService.inscribir,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
    },
  });
}
