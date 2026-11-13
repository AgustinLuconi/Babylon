import { ValidationError } from "../../core/errors";
import type { Rol } from "../../core/ports";
import type { Usuario } from "./usuario.entity";

// Clave del bloqueo que serializa lo que puede dejar al sistema sin administradores (quitar el rol o desactivar a uno).
export const BLOQUEO_DE_ADMINISTRADORES = "administradores";

// Cuántas OTRAS cuentas activas son administradoras.
export function contarOtrosAdminsActivos(usuarios: readonly Pick<Usuario, "id" | "estado" | "roles">[], cuentaId: string): number {
  return usuarios.filter((u) => u.id !== cuentaId && u.estado === "activo" && u.roles.includes("admin")).length;
}

// Qué roles se agregan y cuáles se quitan al pasar de los roles actuales a los finales (el orden no importa).
export function cambioDeRoles(actuales: readonly Rol[], finales: readonly Rol[]): { agregados: Rol[]; quitados: Rol[] } {
  return {
    agregados: finales.filter((r) => !actuales.includes(r)),
    quitados: actuales.filter((r) => !finales.includes(r)),
  };
}

interface Cambio {
  cuentaId: string;
  actorId: string;
  actuales: Rol[];
  finales: Rol[];
  // Cuántas OTRAS cuentas activas son administradoras (para no dejar al sistema sin ninguna).
  otrosAdminsActivos: number;
}

// Reglas de seguridad al cambiar los roles de una cuenta: siempre queda al menos un rol; un administrador no se quita a sí
// mismo el rol de administrador; y el sistema nunca se queda sin un administrador activo.
export function validarCambioDeRoles({ cuentaId, actorId, actuales, finales, otrosAdminsActivos }: Cambio): void {
  if (finales.length === 0) {
    throw new ValidationError("La cuenta tiene que conservar al menos un rol: si ya no tiene que entrar, desactivala", { roles: ["Elegí al menos un rol"] });
  }
  const { quitados } = cambioDeRoles(actuales, finales);
  if (!quitados.includes("admin")) return;
  if (cuentaId === actorId) {
    const mensaje = "No podés quitarte tu propio rol de administrador";
    throw new ValidationError(mensaje, { roles: [mensaje] });
  }
  if (otrosAdminsActivos === 0) {
    const mensaje = "No se puede quitar el rol: el sistema se quedaría sin ningún administrador activo";
    throw new ValidationError(mensaje, { roles: [mensaje] });
  }
}
