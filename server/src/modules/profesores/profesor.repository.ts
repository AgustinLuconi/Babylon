import type { Repository } from "../../core/ports";
import type { Profesor } from "./profesor.entity";

export interface ProfesorRepository extends Repository<Profesor> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Profesor | null>;
  findByDni(dni: string, tx?: unknown): Promise<Profesor | null>;
}
