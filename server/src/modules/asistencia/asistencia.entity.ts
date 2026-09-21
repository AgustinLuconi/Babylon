export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export interface Asistencia {
  id: string;
  alumnoId: string;
  cursoId: string;
  fecha: Date;
  estado: EstadoAsistencia;
  minutosRetraso?: number;
  motivo?: string;
}
