import { useQuery } from "@tanstack/react-query";
import { cursoService } from "../cursoService";

// Cuántos alumnos tiene cada curso en su lista (por inscripciones: un curso de un ciclo viejo sigue contando a quienes cursaron
// en él). Cuelga de "cursos": se vuelve a pedir con los cambios de cursos y de alumnos.
export function useInscriptosPorCurso() {
  return useQuery({
    queryKey: ["cursos", "inscriptos"],
    queryFn: cursoService.contarInscriptos,
  });
}
