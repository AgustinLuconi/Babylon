export interface EventosCalificaciones {
  "evaluacion.creada": { evaluacionId: string };
  "evaluacion.publicada": { evaluacionId: string };
  "calificaciones.cargadas": { evaluacionId: string; alumnoIds: string[] };
  "cierre.cargado": { notaCierreId: string };
  "cierre.publicado": { notaCierreId: string };
}
