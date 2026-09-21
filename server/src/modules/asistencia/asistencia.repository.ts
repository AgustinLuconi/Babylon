import type { Repository } from "../../core/ports";
import type { Asistencia } from "./asistencia.entity";

export interface AsistenciaRepository extends Repository<Asistencia> {
  findByAlumnoCursoFecha(alumnoId: string, cursoId: string, fecha: Date, tx?: unknown): Promise<Asistencia | null>;
  findByAlumnoId(alumnoId: string, tx?: unknown): Promise<Asistencia[]>;
}
