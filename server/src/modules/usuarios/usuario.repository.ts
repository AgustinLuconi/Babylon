import type { Repository } from "../../core/ports";
import type { Usuario } from "./usuario.entity";

export interface UsuarioRepository extends Repository<Usuario> {
  findByEmail(email: string, tx?: unknown): Promise<Usuario | null>;
}
