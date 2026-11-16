import type { TableroDeAnuncios } from "../../core/eventos";
import type { EventosDelSistema } from "../../eventos";
import { REGLA_IDS, type ReglaId } from "./automatizacion.entity";
import type { AutomatizacionService } from "./automatizacion.service";

// Qué reglas se revisan con cada anuncio. Todo corre dentro de la transacción de la operación: si la revisión falla, la
// operación entera se deshace. Los módulos de cuotas, asistencia y alumnos no saben que esto existe.
export function suscribirAutomatizaciones(tablero: TableroDeAnuncios<EventosDelSistema>, servicio: AutomatizacionService): void {
  const revisar = (reglas: ReglaId[]) => (_datos: unknown, tx: unknown) => servicio.evaluar(reglas, tx);

  tablero.alPublicarse("cuotas.cambiaron", revisar(["deuda_cuotas"]));
  tablero.alPublicarse("asistencia.registrada", revisar(["inasistencias_seguidas"]));
  // Baja, reactivación o cambio de curso de un alumno; activar otro ciclo (cambia quiénes están inscriptos en el activo).
  // Lo que cambia una alerta de deuda o de inasistencias puede abrir o cerrar la de riesgo (que se lee de ellas). Va después de
  // revisar esas reglas porque se publica al terminar su revisión.
  tablero.alPublicarse("alertas.cambiaron", async ({ reglaIds }, tx) => {
    if (reglaIds.includes("deuda_cuotas") || reglaIds.includes("inasistencias_seguidas")) await servicio.evaluar(["alumno_en_riesgo"], tx);
  });
  // Una nota cargada cierra la alerta de la evaluación; una evaluación nueva o un curso que se activa/desactiva la cambian.
  tablero.alPublicarse("calificaciones.cargadas", revisar(["evaluacion_sin_notas"]));
  tablero.alPublicarse("evaluacion.creada", revisar(["evaluacion_sin_notas"]));
  tablero.alPublicarse("cursos.cambiaron", revisar(["evaluacion_sin_notas"]));
  tablero.alPublicarse("alumnos.cambiaron", revisar(REGLA_IDS));
  tablero.alPublicarse("ciclo.activado", revisar(REGLA_IDS));
}
