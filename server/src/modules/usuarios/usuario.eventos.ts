import type { MotivoCierre } from "../../core/ports";

export interface EventosUsuarios {
  // La cuenta se activó, se reactivó o se desactivó: cambian los avisos que le corresponden.
  "cuenta.cambio": { usuarioId: string };
  // Se cerraron sesiones de la cuenta: se cortan al instante las conexiones en vivo que ya no valen.
  "sesiones.cerradas": { usuarioId: string; motivo: MotivoCierre };
}
