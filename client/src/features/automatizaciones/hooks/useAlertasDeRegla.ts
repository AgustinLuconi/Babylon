import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { automatizacionService } from "../automatizacionService";
import type { ReglaId } from "../types";

export function useAlertasDeRegla(regla: ReglaId, pagina: number) {
  return useQuery({
    queryKey: ["automatizaciones", regla, "alertas", pagina],
    queryFn: () => automatizacionService.historial(regla, pagina),
    placeholderData: keepPreviousData,
  });
}
