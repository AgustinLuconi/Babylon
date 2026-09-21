import { useQuery } from "@tanstack/react-query";
import { reporteService } from "../reporteService";

export function useResumenDashboard(opciones?: { enabled?: boolean; cicloId?: string }) {
  return useQuery({
    queryKey: ["reportes", "dashboard", opciones?.cicloId],
    queryFn: () => reporteService.obtenerResumenDashboard(opciones?.cicloId),
    enabled: opciones?.enabled ?? true,
  });
}
