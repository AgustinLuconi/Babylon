import type { Rol } from "../../core/ports";

export type EstadoUsuario = "activo" | "inactivo";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  // Un usuario puede tener más de un rol habilitado (ej. el dueño del
  // instituto que también dicta clases) — elige con cuál entra al loguearse,
  // ver UsuarioService.autenticar. El rol activo de la sesión sigue siendo
  // uno solo (JWT, requireRole, etc. no cambian).
  roles: Rol[];
  estado: EstadoUsuario;
  fechaCreacion: Date;
  // Los tokens emitidos antes de este momento dejan de valer (cambio de contraseña o desactivación).
  sesionesValidasDesde?: Date | null;
}

// Cambia el estado de una cuenta. Al desactivarla se cortan sus sesiones para siempre
// (`sesionesValidasDesde`): reactivarla más tarde no revive los tokens que tenía emitidos.
export function conEstado(usuario: Usuario, estado: EstadoUsuario, ahora: Date = new Date()): Usuario {
  return { ...usuario, estado, sesionesValidasDesde: estado === "inactivo" ? ahora : usuario.sesionesValidasDesde };
}
