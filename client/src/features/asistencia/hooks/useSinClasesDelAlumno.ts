import { useQuery } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

// Las clases sin dictar de los cursos de un alumno (a la familia le llegan sin el motivo).
export function useSinClasesDelAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["asistencia", "sin-clases", "alumno", alumnoId],
    queryFn: () => asistenciaService.sinClasesDelAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
