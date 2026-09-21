import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cursoService } from "../cursoService";

export function useCrearCurso() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cursoService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cursos"] });
    },
  });
}
