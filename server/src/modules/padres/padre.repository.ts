import type { Repository } from "../../core/ports";
import type { Padre } from "./padre.entity";

export interface PadreRepository extends Repository<Padre> {
  findByUsuarioId(usuarioId: string, tx?: unknown): Promise<Padre | null>;
  findByDni(dni: string, tx?: unknown): Promise<Padre | null>;
}
