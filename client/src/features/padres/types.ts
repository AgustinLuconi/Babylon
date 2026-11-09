import type { EstadoInvitacion } from "@/features/usuarios/types";

// El vínculo vive en el alumno (Alumno.vinculoResponsable): la misma persona puede ser madre de un alumno y "propio" de
// otro (una mamá que también estudia).
export type VinculoPadre = "padre" | "madre" | "tutor" | "propio";
export type VinculoDeOtraPersona = Exclude<VinculoPadre, "propio">;

export const VINCULO_LABELS: Record<VinculoPadre, string> = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor/a",
  propio: "El propio alumno",
};

// Los que se pueden elegir cuando el responsable es otra persona.
export const VINCULOS_DE_OTRA_PERSONA: VinculoDeOtraPersona[] = ["madre", "padre", "tutor"];

// "Responsable" del alumno (en el código sigue llamándose Padre).
export interface Padre {
  id: string;
  nombre: string;
  apellido: string;
  dni?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

// Lo mínimo es nombre, apellido y celular; el DNI, el email y la dirección se completan después. Con email se crea la
// cuenta (sin contraseña, queda pendiente y se manda una invitación); sin email no hay cuenta.
export interface DatosDeFicha {
  nombre: string;
  apellido: string;
  telefono: string;
  dni?: string;
  email?: string;
  direccion?: string;
  password?: string;
}

export type CrearPadreInput = DatosDeFicha;

// Ausente no se toca; null borra (solo lo que se puede completar después). El celular no se puede borrar.
export interface ActualizarPadreInput {
  nombre?: string;
  apellido?: string;
  dni?: string | null;
  direccion?: string | null;
  telefono?: string;
  email?: string | null;
}

export type PadreCreado = Padre & { invitacion: EstadoInvitacion | null };

// Quién es el responsable de un alumno al inscribirlo o al cambiarlo (igual a `responsableSchema` del servidor).
export type ResponsableElegido =
  | { tipo: "existente"; padreId: string; vinculo: VinculoDeOtraPersona }
  | { tipo: "nuevo"; vinculo: VinculoDeOtraPersona; datos: DatosDeFicha }
  | { tipo: "propio"; telefono: string; email?: string; password?: string };
