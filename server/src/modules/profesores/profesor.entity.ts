export type EstadoProfesor = "activo" | "inactivo";

export interface Profesor {
  id: string;
  nombre: string;
  // Opcional por el mismo motivo que dni/email/usuarioId: de los 4
  // profesores importados de datos históricos, solo se pudo confirmar el
  // apellido real de uno — el resto queda pendiente de completar.
  apellido?: string;
  // Opcional por el mismo motivo que email/usuarioId: un profesor
  // importado de datos históricos puede no tener DNI real disponible
  // todavía (no vino en ninguna fuente de la planilla 2025).
  dni?: string;
  telefono?: string;
  // Ambos opcionales: un profesor importado de datos históricos puede no
  // tener email real todavía (sin cuenta de acceso) hasta conseguirlo —
  // mismo criterio que Padre.email/usuarioId.
  email?: string;
  usuarioId?: string;
  estado: EstadoProfesor;
}
