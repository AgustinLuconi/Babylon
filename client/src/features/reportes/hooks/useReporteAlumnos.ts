import { useQuery } from "@tanstack/react-query";
import { reporteService } from "../reporteService";

export function useReporteAlumnos(cicloId?: string) {
  return useQuery({
    queryKey: ["reportes", "alumnos", cicloId],
    queryFn: () => reporteService.listarReporteAlumnos(cicloId),
  });
}
