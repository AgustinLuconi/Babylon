export type VinculoResponsable = "padre" | "madre" | "tutor" | "propio";
export type EstadoAlumno = "activo" | "inactivo" | "egresado";

export interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
  // DNI y fecha de nacimiento pueden faltar y completarse después (ver `datosFaltantes`).
  dni?: string;
  fechaNacimiento?: Date;
  direccion?: string;
  telefono?: string;
  email?: string;
  foto?: string;
  observacionesMedicas?: string;
  fechaInscripcion: Date;
  estado: EstadoAlumno;
  // Opcional: un alumno importado de datos históricos puede no tener ningún
  // padre/tutor identificado todavía (la fuente real no traía ni nombre ni
  // DNI, solo un teléfono de contacto) — se vincula después cuando se
  // consiga el dato real. El alta en vivo (`POST /api/alumnos`) sigue
  // exigiendo un padre real vía `nuevoAlumnoSchema`, este campo no relaja esa regla.
  padreId?: string;
  // Vínculo con su responsable (la misma persona puede ser madre de un alumno y "propio" de otro).
  vinculoResponsable?: VinculoResponsable;
  cursoId?: string;
  aplicaDescuentoHermanos: boolean;
}
