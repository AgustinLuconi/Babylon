import type { EstadoInvitacion } from "@/features/usuarios/types";

export interface Secretario {
  id: string;
  nombre: string;
  email: string;
  estado: "activo" | "inactivo" | "pendiente";
  fechaCreacion: string;
}

export interface CrearSecretarioInput {
  nombre: string;
  email: string;
  // Sin contraseña, la cuenta queda pendiente y se manda una invitación por email.
  password?: string;
}

export type SecretarioCreado = Secretario & { invitacion: EstadoInvitacion | null };
