import type { EstadoInvitacion } from "./types";

// Aviso tras un alta, según cómo quedó la invitación (null: se asignó contraseña).
export function mensajeDeAlta(email: string, invitacion: EstadoInvitacion | null): string {
  if (invitacion === "enviada") return `Invitación enviada a ${email}`;
  if (invitacion === "no-enviada") return "La cuenta quedó creada pero no se pudo enviar el correo; reenviala desde Usuarios → Pendientes.";
  return `Usuario ${email} creado`;
}
