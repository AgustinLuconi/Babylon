import { useQuery } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

export function useAsistenciaDeAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["asistencia", "alumno", alumnoId],
    queryFn: () => asistenciaService.listarPorAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
