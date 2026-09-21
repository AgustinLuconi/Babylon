export type EstadoAsistencia = "presente" | "tarde" | "ausente";

export const ESTADO_ASISTENCIA_LABELS: Record<EstadoAsistencia, string> = {
  presente: "Presente",
  tarde: "Tarde",
  ausente: "Ausente",
};

export interface RegistroAsistenciaMasiva {
  alumnoId: string;
  estado: EstadoAsistencia;
  minutosRetraso?: number;
  motivo?: string;
}

export interface RegistrarAsistenciaMasivaInput {
  cursoId: string;
  fecha: string;
  registros: RegistroAsistenciaMasiva[];
}

export interface Asistencia {
  id: string;
  alumnoId: string;
  cursoId: string;
  fecha: string;
  estado: EstadoAsistencia;
  minutosRetraso?: number;
  motivo?: string;
}
