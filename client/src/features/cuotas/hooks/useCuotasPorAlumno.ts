import { useQuery } from "@tanstack/react-query";
import { cuotaService } from "../cuotaService";

export function useCuotasPorAlumno(alumnoId: string | null) {
  return useQuery({
    queryKey: ["cuotas", alumnoId],
    queryFn: () => cuotaService.listarPorAlumno(alumnoId as string),
    enabled: alumnoId !== null,
  });
}
