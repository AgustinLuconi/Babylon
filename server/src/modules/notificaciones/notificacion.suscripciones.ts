import type { TableroDeAnuncios } from "../../core/eventos";
import type { EventosDelSistema } from "../../eventos";
import type { TipoEstado } from "./notificacion.entity";
import type { NotificacionService } from "./notificacion.service";
import { TIPOS_ESTADO } from "./notificacion.tipos";

// Qué avisos revisa cada anuncio. Todo corre dentro de la transacción de la operación: si guardar los avisos falla, la
// operación entera se deshace (y no sale ninguna señal).
export function suscribirAvisos(tablero: TableroDeAnuncios<EventosDelSistema>, avisos: NotificacionService): void {
  const sincronizar = (tipos: TipoEstado[]) => (_datos: unknown, tx: unknown) => avisos.sincronizar(tipos, tx);

  tablero.alPublicarse("cuotas.cambiaron", sincronizar(["cuota", "cuotas_vencidas"]));
  tablero.alPublicarse("alumnos.cambiaron", sincronizar(["cuota", "cuotas_vencidas", "documentacion_hijo", "documentacion_pendiente"]));
  tablero.alPublicarse("documentos.cambiaron", sincronizar(["documentacion_hijo", "documentacion_pendiente"]));
  tablero.alPublicarse("asistencia.registrada", sincronizar(["asistencia_pendiente"]));
  tablero.alPublicarse("cursos.cambiaron", sincronizar(["asistencia_pendiente", "evaluacion_proxima", "notas_sin_publicar", "cierre_sin_publicar"]));
  tablero.alPublicarse("ciclo.activado", sincronizar(TIPOS_ESTADO));
  tablero.alPublicarse("cuenta.cambio", sincronizar(TIPOS_ESTADO));
  tablero.alPublicarse("evaluacion.creada", sincronizar(["evaluacion_proxima"]));
  tablero.alPublicarse("evaluacion.publicada", async ({ evaluacionId }, tx) => {
    await avisos.sincronizar(["notas_sin_publicar"], tx);
    await avisos.notasPublicadas(evaluacionId, null, tx);
  });
  tablero.alPublicarse("calificaciones.cargadas", async ({ evaluacionId, alumnoIds }, tx) => {
    await avisos.sincronizar(["notas_sin_publicar"], tx);
    // Notas cargadas en una evaluación ya publicada: el padre también se entera (en borrador no se crea nada).
    await avisos.notasPublicadas(evaluacionId, alumnoIds, tx);
  });
  tablero.alPublicarse("cierre.cargado", sincronizar(["cierre_sin_publicar"]));
  // Un lote publicado sincroniza una sola vez y crea un aviso por nota.
  tablero.alPublicarse("cierre.publicado", async ({ notaCierreIds }, tx) => {
    await avisos.sincronizar(["cierre_sin_publicar"], tx);
    for (const id of notaCierreIds) await avisos.cierrePublicado(id, tx);
  });
  tablero.alPublicarse("observacion.creada", ({ observacionId }, tx) => avisos.observacionNueva(observacionId, tx));
  // Un mensaje nuevo o una conversación leída cambian los avisos de los dos lados.
  tablero.alPublicarse("chat.mensaje", sincronizar(["mensajes_familia", "mensajes_instituto"]));
  tablero.alPublicarse("chat.leido", sincronizar(["mensajes_familia", "mensajes_instituto"]));
}
