export type VinculoPadre = "padre" | "madre" | "tutor";

export interface Padre {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  direccion?: string;
  telefono?: string;
  // Ambos opcionales: un padre importado de datos históricos (ej. ciclo
  // 2025) puede no tener email real todavía, y sin email no se le puede
  // crear una cuenta de acceso — usuarioId queda vacío hasta que se
  // consiga el dato real y se le dé de alta el login.
  email?: string;
  vinculo: VinculoPadre;
  usuarioId?: string;
}
