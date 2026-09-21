import { useQuery } from "@tanstack/react-query";
import { cursoService } from "../cursoService";

export function useHorarios() {
  return useQuery({
    queryKey: ["cursos", "horarios"],
    queryFn: cursoService.listarHorarios,
  });
}
