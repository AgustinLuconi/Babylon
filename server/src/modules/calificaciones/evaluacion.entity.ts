export type TipoEvaluacion = "examen" | "trabajo_practico" | "oral" | "proyecto";
export type PeriodoAcademico = "julio" | "noviembre";
export type EstadoEvaluacion = "borrador" | "publicada";

export interface Evaluacion {
  id: string;
  cursoId: string;
  nombre: string;
  tipo: TipoEvaluacion;
  fecha: Date;
  periodo: PeriodoAcademico;
  estado: EstadoEvaluacion;
  // Cuándo se publicó (null si se publicó antes de que existiera el campo).
  publicadaEn?: Date | null;
}
