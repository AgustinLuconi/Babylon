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
}
