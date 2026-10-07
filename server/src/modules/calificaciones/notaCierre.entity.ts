import type { EstadoEvaluacion, PeriodoAcademico } from "./evaluacion.entity";

export interface NotaCierre {
  id: string;
  alumnoId: string;
  cursoId: string;
  periodo: PeriodoAcademico;
  nota: string;
  observacion?: string;
  estado: EstadoEvaluacion;
  // Cuándo se publicó (null si se publicó antes de que existiera el campo).
  publicadaEn?: Date | null;
}
