import type { Rol } from "@/features/auth/types";

export interface CambiarContrasenaInput {
  passwordActual: string;
  passwordNueva: string;
}

export interface SesionActiva {
  id: string;
  dispositivo: string;
  ip: string | null;
  creadaEn: string;
  ultimoUsoEn: string;
  // true en la sesión desde la que se está mirando.
  actual: boolean;
}

// Lo que la persona ve de su propia cuenta (GET /api/auth/yo).
export interface DatosPropios {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  emailVerificado: boolean;
}
