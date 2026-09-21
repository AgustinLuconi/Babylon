import { useMemo } from "react";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useCursos } from "./useCursos";

// Las pantallas de Profesor trabajan sobre el ciclo lectivo en curso: los
// cursos de ciclos anteriores quedan como historial (se consultan desde el
// panel de Admin) y no deben aparecer como "próximas clases" ni como
// opciones para tomar asistencia o cargar notas.
export function useCursosDelCicloActivo() {
  const consulta = useCursos();
  const { data: ciclos, isLoading: cargandoCiclos } = useCiclos();
  const cicloActivo = ciclos?.find((c) => c.activo);

  const data = useMemo(() => {
    if (!consulta.data || !ciclos) return undefined;
    return cicloActivo ? consulta.data.filter((c) => c.cicloId === cicloActivo.id) : consulta.data;
  }, [consulta.data, ciclos, cicloActivo]);

  return { ...consulta, data, isLoading: consulta.isLoading || cargandoCiclos };
}
