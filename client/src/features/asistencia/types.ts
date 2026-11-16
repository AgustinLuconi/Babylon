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
  // Solo una ausencia se justifica, y entonces el motivo es obligatorio.
  justificada?: boolean;
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
  justificada: boolean;
}

// Cómo se nombra un registro: una ausencia justificada lo dice.
export function etiquetaDeAsistencia(r: { estado: EstadoAsistencia; justificada: boolean }): string {
  return r.estado === "ausente" && r.justificada ? "Ausente (justificada)" : ESTADO_ASISTENCIA_LABELS[r.estado];
}
