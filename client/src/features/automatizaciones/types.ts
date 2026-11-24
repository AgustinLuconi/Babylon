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

// Qué significa cada motivo de cierre (se muestran en el desplegable "¿Cómo leer este historial?" debajo de la tabla).
export const MOTIVO_AYUDA: Record<MotivoCierre, string> = {
  resuelta: "La situación se solucionó: el alumno pagó, volvió a asistir o se cargó una nota.",
  "regla-apagada": "Se apagó la regla desde este panel, así que se cerraron sus alertas abiertas.",
  "cambio-de-numero":
    "Se cambió el número de la regla y esta alerta dejó de alcanzarlo (por ejemplo, de 2 a 4 cuotas). Era válida con el número anterior; el historial no se modifica.",
  "ya-no-corresponde":
    "Ya no tiene sentido seguir vigilando el caso: el alumno se dio de baja, cambió de curso, el curso se desactivó o se activó otro ciclo. La alerta se cierra sola; no quiere decir que el problema se haya solucionado.",
};

// Qué mide la columna "Nivel" en cada regla que lo usa (en las otras la columna no se muestra).
export const NIVEL_LABELS: Partial<Record<ReglaId, { titulo: string; ayuda: string }>> = {
  deuda_cuotas: { titulo: "Cuotas vencidas", ayuda: "Cantidad de cuotas vencidas que tenía el alumno (sube si debe una más con la alerta abierta)." },
  inasistencias_seguidas: { titulo: "Faltas seguidas", ayuda: "Largo de la racha de faltas sin justificar (sube si falta una vez más con la alerta abierta)." },
};
