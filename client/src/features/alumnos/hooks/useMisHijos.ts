import { useQuery } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

// `enabled: false` para las cuentas que no son de responsable (el endpoint es solo suyo).
export function useMisHijos({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["alumnos", "mios"],
    queryFn: alumnoService.misHijos,
    enabled,
  });
}
