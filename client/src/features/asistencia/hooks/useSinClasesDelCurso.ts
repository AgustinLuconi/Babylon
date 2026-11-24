import { useQuery } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

// Las clases sin dictar de un curso, con el motivo (solo lo piden el profesor, administración y secretaría). La clave empieza con
// "asistencia": las señales en vivo de asistencia ya la vuelven a pedir.
export function useSinClasesDelCurso(cursoId: string | undefined) {
  return useQuery({
    queryKey: ["asistencia", "sin-clases", "curso", cursoId],
    queryFn: () => asistenciaService.sinClasesDelCurso(cursoId as string),
    enabled: cursoId !== undefined,
  });
}
