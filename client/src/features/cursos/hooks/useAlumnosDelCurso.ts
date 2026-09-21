import { useQuery } from "@tanstack/react-query";
import { cursoService } from "../cursoService";

export function useAlumnosDelCurso(cursoId: string | undefined) {
  return useQuery({
    queryKey: ["cursos", cursoId, "alumnos"],
    queryFn: () => cursoService.listarAlumnos(cursoId as string),
    enabled: cursoId !== undefined,
  });
}
