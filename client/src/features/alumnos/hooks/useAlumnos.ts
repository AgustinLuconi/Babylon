import { useQuery } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

export function useAlumnos(cicloId?: string) {
  return useQuery({
    queryKey: ["alumnos", cicloId],
    queryFn: () => alumnoService.listar(cicloId),
  });
}
