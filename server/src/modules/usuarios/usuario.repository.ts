import type { Repository } from "../../core/ports";
import type { TipoTokenCuenta, TokenCuenta } from "./tokenCuenta.entity";
import type { Usuario } from "./usuario.entity";

export type CambiosUsuario = Partial<Pick<Usuario, "nombre" | "email" | "passwordHash" | "estado" | "emailVerificadoEn">>;

export interface UsuarioRepository extends Repository<Usuario> {
  findByEmail(email: string, tx?: unknown): Promise<Usuario | null>;

  // Cambia SOLO los campos indicados, sin reescribir el resto de la fila: así dos cambios simultáneos sobre la
  // misma cuenta (por ejemplo una contraseña nueva y un cambio de estado) no se pisan.
  actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario>;
  // Toma un bloqueo exclusivo hasta que termina la transacción: los pedidos simultáneos sobre la misma clave se hacen
  // de a uno (también entre varios servidores). La clave suele ser el id de la cuenta, pero puede ser cualquier texto
  // (ej. "padre:<id>" o "email:<email>" al invitar a alguien que todavía no tiene cuenta).
  bloquearCuenta(clave: string, tx: unknown): Promise<void>;

  crearToken(token: TokenCuenta, tx?: unknown): Promise<TokenCuenta>;
  // Borra un enlace (ej. el que nunca llegó a enviarse porque el correo falló). No falla si ya no existe.
  eliminarToken(id: string, tx?: unknown): Promise<void>;
  findTokenPorHash(hash: string, tx?: unknown): Promise<TokenCuenta | null>;
  findTokensDesde(usuarioId: string, tipo: TipoTokenCuenta, desde: Date, tx?: unknown): Promise<TokenCuenta[]>;
  findTokensDeUsuarios(usuarioIds: string[], tipo: TipoTokenCuenta, tx?: unknown): Promise<TokenCuenta[]>;
  // Marca usados los enlaces aún sin usar de ese tipo (pedir uno nuevo anula los anteriores).
  invalidarTokens(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date, tx?: unknown): Promise<void>;
  // Marca usado un enlace solo si todavía no lo estaba; false si otro pedido lo usó primero.
  marcarTokenUsado(id: string, ahora: Date, tx?: unknown): Promise<boolean>;
}
