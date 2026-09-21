import type { Repository } from "../../core/ports";
import type { Ciclo } from "./ciclo.entity";
import type { Inscripcion } from "./inscripcion.entity";

export interface CicloRepository extends Repository<Ciclo> {
  findByAnio(anio: number, tx?: unknown): Promise<Ciclo | null>;
  findActivo(tx?: unknown): Promise<Ciclo | null>;
  desactivarTodos(tx?: unknown): Promise<void>;

  crearInscripcion(inscripcion: Inscripcion, tx?: unknown): Promise<Inscripcion>;
  actualizarInscripcion(
    alumnoId: string,
    cicloId: string,
    datos: Partial<Pick<Inscripcion, "cursoId" | "aplicaDescuentoHermanos">>,
    tx?: unknown,
  ): Promise<Inscripcion>;
  findInscripcionByAlumnoYCiclo(alumnoId: string, cicloId: string, tx?: unknown): Promise<Inscripcion | null>;
  findInscripcionesByAlumnoId(alumnoId: string, tx?: unknown): Promise<Inscripcion[]>;
  findInscripcionesByCicloId(cicloId: string, tx?: unknown): Promise<Inscripcion[]>;
}
