import { useQuery } from "@tanstack/react-query";
import { cursoService } from "../cursoService";

export function useCursos() {
  return useQuery({
    queryKey: ["cursos"],
    queryFn: cursoService.listar,
  });
}
