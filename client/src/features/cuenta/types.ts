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
