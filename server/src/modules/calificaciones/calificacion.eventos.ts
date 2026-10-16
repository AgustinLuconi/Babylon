export interface EventosCalificaciones {
  "evaluacion.creada": { evaluacionId: string };
  "evaluacion.publicada": { evaluacionId: string };
  "calificaciones.cargadas": { evaluacionId: string; alumnoIds: string[] };
  "cierre.cargado": { notaCierreIds: string[] };
  "cierre.publicado": { notaCierreIds: string[] };
}
