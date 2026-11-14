import type { CausaDescuento } from "./alumno.hermanos";

// Un alumno cuyo descuento por hermanos cambió. `alumnoDeLaCausaId` es el alumno que provocó el cambio (el que se dio
// de baja, volvió o cambió de responsable).
export interface CambioDeDescuento {
  alumnoId: string;
  aplica: boolean;
  causa: CausaDescuento;
  alumnoDeLaCausaId: string | null;
}

export interface EventosAlumnos {
  "alumnos.cambiaron": { alumnoId: string };
  // Se publica dentro de la transacción del cambio, solo si cambió el descuento de alguien.
  "alumnos.descuentoCambio": { cambios: CambioDeDescuento[] };
}
