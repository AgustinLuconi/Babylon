export type TipoEvaluacion = "examen" | "trabajo_practico" | "oral" | "proyecto";
export type PeriodoAcademico = "julio" | "noviembre";
export type EscalaEvaluacion = "numerica" | "conceptual";
export type EstadoEvaluacion = "borrador" | "publicada";

export interface Evaluacion {
  id: string;
  cursoId: string;
  nombre: string;
  tipo: TipoEvaluacion;
  fecha: Date;
  periodo: PeriodoAcademico;
  escala: EscalaEvaluacion;
  estado: EstadoEvaluacion;
}
