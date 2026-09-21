import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActualizarCursoInput } from "../types";
import { cursoService } from "../cursoService";

export function useActualizarCurso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: ActualizarCursoInput }) => cursoService.actualizar(id, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cursos"] });
    },
  });
}
