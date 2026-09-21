import { useQuery } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";

export function useCalificacionesDeAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["calificaciones", "alumno", alumnoId],
    queryFn: () => calificacionService.listarCalificacionesPorAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
