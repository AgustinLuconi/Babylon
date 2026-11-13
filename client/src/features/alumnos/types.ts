import type { ResponsableElegido, VinculoPadre } from "@/features/padres/types";

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
  // DNI y fecha de nacimiento pueden faltar y completarse después.
  dni?: string;
  fechaNacimiento?: string;
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
  // Vínculo con su responsable: madre, padre, tutor o "propio" (un adulto, responsable de sí mismo).
  vinculoResponsable?: VinculoPadre;
  cursoId?: string;
  aplicaDescuentoHermanos: boolean;
}

export interface HijoConCurso extends Alumno {
  cursoNombre: string | null;
  cursoNivel: string | null;
  profesorNombre: string | null;
}

// Lo mínimo para inscribir: nombre, apellido, curso y responsable. Todo lo demás se completa después.
export interface NuevoAlumnoInput {
  nombre: string;
  apellido: string;
  cursoId: string;
  responsable: ResponsableElegido;
  dni?: string;
  fechaNacimiento?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  observacionesMedicas?: string;
}

// Ausente no se toca; null borra (solo lo que se puede completar después).
export interface ActualizarAlumnoInput {
  nombre?: string;
  apellido?: string;
  dni?: string | null;
  fechaNacimiento?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  observacionesMedicas?: string | null;
  cursoId?: string;
  estado?: EstadoAlumno;
}
