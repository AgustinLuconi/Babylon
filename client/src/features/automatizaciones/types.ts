// Mismos nombres que en el server (no comparten código).
export type ReglaId = "deuda_cuotas" | "inasistencias_seguidas" | "evaluacion_sin_notas" | "alumno_en_riesgo";
export type MotivoCierre = "resuelta" | "regla-apagada" | "cambio-de-numero" | "ya-no-corresponde";

export interface ReglaConEstado {
  id: ReglaId;
  nombre: string;
  descripcion: string;
  unidad: string;
  umbralMinimo: number;
  umbralMaximo: number;
  // false: la regla no tiene número que se elija (alumno en riesgo usa los de las otras).
  conNumero: boolean;
  sujetoSingular: string;
  sujetoPlural: string;
  conNivel: boolean;
  activa: boolean;
  umbral: number;
  enAlerta: number;
  ultimaRevisionEn: string | null;
}

export interface AlertaDelHistorial {
  id: string;
  // El sujeto de la alerta es un alumno o una evaluación.
  alumnoId: string | null;
  alumnoNombre: string | null;
  evaluacionId: string | null;
  evaluacionNombre: string | null;
  cursoNombre: string | null;
  nivel: number;
  abiertaEn: string;
  resueltaEn: string | null;
  motivoCierre: MotivoCierre | null;
}

export interface HistorialDeAlertas {
  alertas: AlertaDelHistorial[];
  total: number;
  porPagina: number;
}

export interface ActualizarAutomatizacionInput {
  activa?: boolean;
  umbral?: number;
}

export const MOTIVO_LABELS: Record<MotivoCierre, string> = {
  resuelta: "Resuelta",
  "regla-apagada": "Regla apagada",
  "cambio-de-numero": "Cambio de número",
  "ya-no-corresponde": "Ya no corresponde",
};
