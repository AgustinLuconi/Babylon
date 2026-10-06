import type { Repository } from "../../core/ports";
import type { TokenRecuperacion } from "./tokenRecuperacion.entity";
import type { Usuario } from "./usuario.entity";

export interface UsuarioRepository extends Repository<Usuario> {
  findByEmail(email: string, tx?: unknown): Promise<Usuario | null>;

  crearTokenRecuperacion(token: TokenRecuperacion, tx?: unknown): Promise<TokenRecuperacion>;
  findTokenRecuperacionPorHash(hash: string, tx?: unknown): Promise<TokenRecuperacion | null>;
  findTokensRecuperacionDesde(usuarioId: string, desde: Date, tx?: unknown): Promise<TokenRecuperacion[]>;
  // Marca usados los enlaces aún sin usar de la cuenta (pedir uno nuevo o cambiar la contraseña invalida los anteriores).
  invalidarTokensRecuperacion(usuarioId: string, ahora: Date, tx?: unknown): Promise<void>;
  // Marca usado un enlace solo si todavía no lo estaba; false si otro pedido lo usó primero.
  marcarTokenRecuperacionUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean>;
}
