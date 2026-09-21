import { useMutation, useQueryClient } from "@tanstack/react-query";
import { observacionService } from "../observacionService";

export function useCrearCategoriaPersonalizada() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: observacionService.crearCategoriaPersonalizada,
    onSuccess: (categoria) => {
      queryClient.invalidateQueries({ queryKey: ["categoriasPersonalizadas", categoria.cursoId] });
    },
  });
}
