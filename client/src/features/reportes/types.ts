export interface CuotaVencidaResumen {
  alumnoId: string;
  alumnoNombre: string;
  cursoNombre: string | null;
  cursoNivel: string | null;
  mes: number;
  anio: number;
  monto: number;
  diasVencido: number;
}

export interface EvaluacionProximaResumen {
  evaluacionId: string;
  nombre: string;
  tipo: string;
  fecha: string;
  cursoNombre: string;
  cursoNivel: string;
  profesorNombre: string;
}

export type TipoActividad = "enrollment" | "payment" | "observation";

export interface ActividadResumen {
  tipo: TipoActividad;
  actor: string;
  verbo: string;
  objetivo: string;
  fecha: string;
}

export interface NotaCierreResumen {
  nota: number | null;
  estado: string;
}

export interface ReporteAlumnoResumen {
  alumnoId: string;
  alumnoNombre: string;
  cursoNombre: string | null;
  cursoNivel: string | null;
  promedioJulio: number | null;
  promedioNoviembre: number | null;
  notaCierreJulio: NotaCierreResumen | null;
  notaCierreNoviembre: NotaCierreResumen | null;
  asistenciaPct: number | null;
  cuotasPagas: number;
  cuotasVencidas: number;
  deudaTotal: number;
  montoPagadoTotal: number;
  ultimoPago: { mes: number; anio: number } | null;
}

export interface TendenciasDashboard {
  mesAnteriorNombre: string;
  alumnosNuevosMes: number;
  cuotasAlDiaVariacionPp: number | null;
  asistenciaVariacionPp: number | null;
}

export interface ResumenDashboard {
  alumnosActivos: number;
  cuotasAlDiaPct: number;
  asistenciaPromedioPct: number;
  cursosActivos: number;
  docentesCount: number;
  nivelesCount: number;
  cuotasVencidas: CuotaVencidaResumen[];
  proximasEvaluaciones: EvaluacionProximaResumen[];
  composicionPorNivel: Record<string, number>;
  actividadReciente: ActividadResumen[];
  cobradoHoyMonto: number;
  cobradoHoyCount: number;
  documentacionPendienteCount: number;
  // null cuando el ciclo consultado no es el año en curso.
  tendencias: TendenciasDashboard | null;
}
