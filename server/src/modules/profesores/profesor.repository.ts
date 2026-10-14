import type { Repository } from "../../core/ports";
import type { Profesor } from "./profesor.entity";

export interface ProfesorRepository extends Repository<Profesor> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Profesor | null>;
  findByDni(dni: string, tx?: unknown): Promise<Profesor | null>;
  // Solo asigna la cuenta de acceso, sin reescribir el resto de la ficha (una edición simultánea no se pisa).
  vincularUsuario(id: string, usuarioId: string, tx?: unknown): Promise<void>;
}
