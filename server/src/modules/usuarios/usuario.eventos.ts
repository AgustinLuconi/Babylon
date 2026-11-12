import type { MotivoCierre, Rol } from "../../core/ports";

export interface EventosUsuarios {
  // La cuenta se activó, se reactivó, se desactivó o cambió de roles: cambian los avisos que le corresponden. Los roles que
  // perdió se informan aparte: sus avisos se borran (un aviso de un rol que ya no tiene no debe quedar a la vista).
  "cuenta.cambio": { usuarioId: string; rolesQuitados?: Rol[] };
  // Se cerraron sesiones de la cuenta: se cortan al instante las conexiones en vivo que ya no valen.
  "sesiones.cerradas": { usuarioId: string; motivo: MotivoCierre };
}
