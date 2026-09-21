import { useQuery } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

export function useMisHijos() {
  return useQuery({
    queryKey: ["alumnos", "mios"],
    queryFn: alumnoService.misHijos,
  });
}
