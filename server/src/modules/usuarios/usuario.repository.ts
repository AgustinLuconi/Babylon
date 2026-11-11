import type { Repository } from "../../core/ports";
import type { Usuario } from "./usuario.entity";

export type CambiosUsuario = Partial<Pick<Usuario, "nombre" | "email" | "passwordHash" | "estado" | "roles">>;

export interface UsuarioRepository extends Repository<Usuario> {
  findByEmail(email: string, tx?: unknown): Promise<Usuario | null>;

  // Cambia SOLO los campos indicados, sin reescribir el resto de la fila: así dos cambios simultáneos sobre la
  // misma cuenta (por ejemplo una contraseña nueva y un cambio de estado) no se pisan.
  actualizarParcial(id: string, cambios: CambiosUsuario, tx?: unknown): Promise<Usuario>;
  // Toma un bloqueo exclusivo hasta que termina la transacción: los pedidos simultáneos sobre la misma clave se hacen
  // de a uno (también entre varios servidores). La clave suele ser el id de la cuenta, pero puede ser cualquier texto
  // (ej. "email:<email>" al crear una cuenta para un email que todavía no tiene).
  bloquearCuenta(clave: string, tx: unknown): Promise<void>;

}
