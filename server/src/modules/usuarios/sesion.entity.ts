// Entidad secundaria de usuarios/: una sesión por inicio de sesión (por dispositivo).
export interface Sesion {
  id: string;
  usuarioId: string;
  // Texto legible deducido del navegador, ej. "Chrome en Windows".
  dispositivo: string;
  ip: string | null;
  creadaEn: Date;
  ultimoUsoEn: Date;
  expiraEn: Date;
  cerradaEn: Date | null;
}

// El último uso se registra como máximo una vez cada 5 minutos: una sesión que no se usa no escribe y una que
// se usa sin parar escribe 12 veces por hora, nunca en cada pedido.
export const MIN_ENTRE_REGISTROS_DE_USO_MS = 5 * 60 * 1000;

// Tope de sesiones abiertas a la vez por cuenta: al iniciar una nueva estando en el tope, se cierra la menos usada.
// Evita que una cuenta acumule sesiones sin límite (cada una es una fila hasta 90 días después de terminar).
export const MAX_SESIONES_ACTIVAS = 10;
