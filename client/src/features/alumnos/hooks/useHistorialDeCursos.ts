import { useQuery } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

// Cuelga de "alumnos": se vuelve a pedir con los cambios de alumnos (por ejemplo, un pase de año).
export function useHistorialDeCursos(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["alumnos", alumnoId, "historial-cursos"],
    queryFn: () => alumnoService.historialDeCursos(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
