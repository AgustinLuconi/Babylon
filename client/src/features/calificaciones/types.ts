export type TipoEvaluacion = "examen" | "trabajo_practico" | "oral" | "proyecto";
export type PeriodoAcademico = "julio" | "noviembre";
export type EstadoEvaluacion = "borrador" | "publicada";

export const TIPO_EVALUACION_LABELS: Record<TipoEvaluacion, string> = {
  examen: "Examen",
  trabajo_practico: "Trabajo práctico",
  oral: "Oral",
  proyecto: "Proyecto",
};

export const PERIODO_LABELS: Record<PeriodoAcademico, string> = {
  julio: "Julio",
  noviembre: "Noviembre",
};

// Rótulos de cierre del prototipo: "1° Cierre (Julio)" para botones y "1° Cierre" en líneas de detalle.
export const PERIODO_CIERRE_LABELS: Record<PeriodoAcademico, string> = {
  julio: "1° Cierre (Julio)",
  noviembre: "2° Cierre (Noviembre)",
};
export const PERIODO_CIERRE_CORTO: Record<PeriodoAcademico, string> = {
  julio: "1° Cierre",
  noviembre: "2° Cierre",
};

// Largo máximo de la observación al padre que acompaña a una nota.
export const MAX_OBSERVACION_NOTA = 200;

export interface Evaluacion {
  id: string;
  cursoId: string;
  nombre: string;
  tipo: TipoEvaluacion;
  fecha: string;
  periodo: PeriodoAcademico;
  estado: EstadoEvaluacion;
}

export interface Calificacion {
  id: string;
  evaluacionId: string;
  alumnoId: string;
  nota: string;
  observacion?: string;
}

export interface CalificacionConEvaluacion extends Calificacion {
  cursoId: string;
  evaluacionNombre: string;
  evaluacionTipo: TipoEvaluacion;
  evaluacionFecha: string;
  evaluacionPeriodo: PeriodoAcademico;
}

export interface NotaCierre {
  id: string;
  alumnoId: string;
  cursoId: string;
  periodo: PeriodoAcademico;
  nota: string;
  observacion?: string;
  estado: EstadoEvaluacion;
}

export interface CrearEvaluacionInput {
  cursoId: string;
  nombre: string;
  tipo: TipoEvaluacion;
  fecha: string;
  periodo: PeriodoAcademico;
}

export interface NotaInput {
  alumnoId: string;
  nota: string;
  observacion?: string;
}

export interface CargarCalificacionesInput {
  notas: NotaInput[];
}

export interface CargarNotaCierreInput {
  alumnoId: string;
  cursoId: string;
  periodo: PeriodoAcademico;
  nota: string;
  observacion?: string;
}
