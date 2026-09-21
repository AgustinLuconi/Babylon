import { useQuery } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function useNotasCierreDeAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["notasCierre", "alumno", alumnoId],
    queryFn: () => calificacionService.listarNotasCierrePorAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
