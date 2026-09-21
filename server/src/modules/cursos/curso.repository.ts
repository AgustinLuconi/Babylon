import type { Repository } from "../../core/ports";
import type { Curso } from "./curso.entity";
import type { Horario } from "./horario.entity";

export interface CursoRepository extends Repository<Curso> {
  findByProfesorId(profesorId: string, tx?: unknown): Promise<Curso[]>;
  findByCicloId(cicloId: string, tx?: unknown): Promise<Curso[]>;
  agregarHorario(horario: Horario, tx?: unknown): Promise<Horario>;
  findHorariosByCursoId(cursoId: string, tx?: unknown): Promise<Horario[]>;
  findAllHorarios(tx?: unknown): Promise<Horario[]>;
  eliminarHorariosByCursoId(cursoId: string, tx?: unknown): Promise<void>;
}
