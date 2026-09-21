import { useQuery } from "@tanstack/react-query";
import { observacionService } from "../observacionService";

export function useObservacionesPorAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["observaciones", alumnoId],
    queryFn: () => observacionService.listarPorAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
