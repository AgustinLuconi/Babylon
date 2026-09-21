export type EstadoAlumno = "activo" | "inactivo" | "egresado";

export const ESTADO_ALUMNO_LABELS: Record<EstadoAlumno, string> = {
  activo: "Activo",
  inactivo: "Inactivo",
  egresado: "Egresado",
};

export const ESTADO_ALUMNO_VARIANT: Record<EstadoAlumno, "success" | "neutral" | "warning"> = {
  activo: "success",
  inactivo: "neutral",
  egresado: "warning",
};

export interface Alumno {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  foto?: string;
  observacionesMedicas?: string;
  fechaInscripcion: string;
  estado: EstadoAlumno;
  // Un alumno importado de datos históricos puede no tener padre/tutor
  // identificado todavía (la fuente real no traía ese dato) — el alta en
  // vivo (`InscribirAlumnoPage`) sigue exigiendo uno real, ver `NuevoAlumnoInput`.
  padreId?: string;
  cursoId?: string;
  aplicaDescuentoHermanos: boolean;
}

export interface HijoConCurso extends Alumno {
  cursoNombre: string | null;
  cursoNivel: string | null;
  profesorNombre: string | null;
}

export interface NuevoAlumnoInput {
  nombre: string;
  apellido: string;
  dni: string;
  fechaNacimiento: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  observacionesMedicas?: string;
  padreId: string;
  cursoId?: string;
}

export interface ActualizarAlumnoInput {
  nombre?: string;
  apellido?: string;
  fechaNacimiento?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  observacionesMedicas?: string;
  cursoId?: string;
  estado?: EstadoAlumno;
}
