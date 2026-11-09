import { useQuery } from "@tanstack/react-query";
import { alumnoService } from "../alumnoService";

// { [alumnoId]: lo que le falta } de los alumnos activos del ciclo activo con datos incompletos (solo administración y secretaría).
export function useAlumnosIncompletos() {
  return useQuery({ queryKey: ["alumnos", "incompletos"], queryFn: alumnoService.incompletos });
}
