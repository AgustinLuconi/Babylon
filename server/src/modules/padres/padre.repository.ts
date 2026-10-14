import type { Repository } from "../../core/ports";
import type { Padre } from "./padre.entity";

export interface PadreRepository extends Repository<Padre> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Padre | null>;
  findByDni(dni: string, tx?: unknown): Promise<Padre | null>;
  // Solo asigna la cuenta de acceso, sin reescribir el resto de la ficha (una edición simultánea no se pisa).
  vincularUsuario(id: string, usuarioId: string, tx?: unknown): Promise<void>;
}
