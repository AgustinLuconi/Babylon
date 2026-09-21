export type VinculoPadre = "padre" | "madre" | "tutor";

export const VINCULO_LABELS: Record<VinculoPadre, string> = {
  padre: "Padre",
  madre: "Madre",
  tutor: "Tutor/a",
};

export interface Padre {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  vinculo: VinculoPadre;
}

export interface CrearPadreInput {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  email: string;
  password: string;
  vinculo: VinculoPadre;
}

export interface ActualizarPadreInput {
  nombre?: string;
  apellido?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  vinculo?: VinculoPadre;
}
