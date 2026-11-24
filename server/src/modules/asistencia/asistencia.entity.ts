export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export interface Asistencia {
  id: string;
  alumnoId: string;
  cursoId: string;
  fecha: Date;
  estado: EstadoAsistencia;
  minutosRetraso?: number;
  motivo?: string;
  justificada: boolean;
}

// Una clase que no se dio: un hecho del curso y del día (no de cada alumno). No cuenta como falta ni como asistencia.
export interface ClaseSinDictar {
  id: string;
  cursoId: string;
  fecha: Date;
  motivo?: string;
  registradaPor: string;
  creadaEn: Date;
}
