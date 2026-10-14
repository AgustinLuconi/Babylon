import type { Rol } from "@/features/auth/types";

export type EstadoCuenta = "activo" | "inactivo" | "pendiente";

// Cuenta de acceso (Usuario) — la API nunca expone el hash de la contraseña.
export interface CuentaUsuario {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
  estado: EstadoCuenta;
  fechaCreacion: string;
}

// Cómo terminó la invitación de un alta; null: se asignó contraseña y no hubo invitación.
export type EstadoInvitacion = "enviada" | "no-enviada";
export type CuentaCreada = CuentaUsuario & { invitacion: EstadoInvitacion | null };

export interface CrearAdministradorInput {
  nombre: string;
  email: string;
  // Sin contraseña, la cuenta queda pendiente y se manda una invitación por email.
  password?: string;
}

export type EtiquetaAcceso = "sin-cuenta" | "pendiente" | "vencida";

// Una fila de la pestaña Pendientes (GET /api/auth/pendientes).
export interface FilaPendiente {
  clave: string;
  origen: "padre" | "profesor" | "cuenta";
  padreId: string | null;
  profesorId: string | null;
  usuarioId: string | null;
  nombre: string;
  email: string | null;
  roles: Rol[];
  etiqueta: EtiquetaAcceso;
  invitacionEnviadaEn: string | null;
  invitacionVenceEn: string | null;
  sinEmail: boolean;
  emailEnUso: boolean;
}

export interface ResultadoEnvio {
  id: string;
  nombre: string;
  resultado: EstadoInvitacion;
  motivo?: string;
}

export interface InvitarInput {
  padreIds: string[];
  profesorIds: string[];
}
