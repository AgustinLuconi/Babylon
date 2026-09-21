import { useQuery } from "@tanstack/react-query";
import { observacionService } from "../observacionService";

export function useCategoriasPersonalizadas(cursoId: string | undefined) {
  return useQuery({
    queryKey: ["categoriasPersonalizadas", cursoId],
    queryFn: () => observacionService.listarCategoriasPersonalizadas(cursoId as string),
    enabled: cursoId !== undefined,
  });
}
