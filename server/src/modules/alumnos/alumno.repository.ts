import type { Repository } from "../../core/ports";
import type { Alumno } from "./alumno.entity";

export interface AlumnoRepository extends Repository<Alumno> {
  findByDni(dni: string, tx?: unknown): Promise<Alumno | null>;
  findByPadreId(padreId: string, tx?: unknown): Promise<Alumno[]>;
  findByCursoId(cursoId: string, tx?: unknown): Promise<Alumno[]>;
}
