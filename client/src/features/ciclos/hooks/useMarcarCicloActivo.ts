import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";

export function useMarcarCicloActivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cicloService.marcarActivo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ciclos"] });
      // Cambiar el ciclo activo redefine qué cursos/alumnos son "los de
      // este año" en toda la app — se invalida todo lo que depende de eso.
      queryClient.invalidateQueries({ queryKey: ["cursos"] });
    },
  });
}
