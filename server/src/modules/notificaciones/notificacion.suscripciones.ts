import type { TableroDeAnuncios } from "../../core/eventos";
import type { EventosDelSistema } from "../../eventos";
import type { TipoEstado } from "./notificacion.entity";
import type { NotificacionService } from "./notificacion.service";
import { TIPOS_ESTADO } from "./notificacion.tipos";

// Qué tipos de aviso salen de las alertas de cada regla de automatizaciones (ids de regla como texto: este módulo no importa
// nada del de automatizaciones).
const TIPOS_POR_REGLA: Record<string, TipoEstado[]> = {
  deuda_cuotas: ["alumno_con_deuda"],
  inasistencias_seguidas: ["alumno_con_faltas", "alumno_con_faltas_profesor"],
  alumno_en_riesgo: ["alumno_en_riesgo"],
  evaluacion_sin_notas: ["evaluacion_sin_notas", "evaluacion_sin_notas_profesor"],
};

// Qué avisos revisa cada anuncio. Todo corre dentro de la transacción de la operación: si guardar los avisos falla, la
// operación entera se deshace (y no sale ninguna señal).
export function suscribirAvisos(tablero: TableroDeAnuncios<EventosDelSistema>, avisos: NotificacionService): void {
  const sincronizar = (tipos: TipoEstado[]) => (_datos: unknown, tx: unknown) => avisos.sincronizar(tipos, tx);

  tablero.alPublicarse("cuotas.cambiaron", sincronizar(["cuota", "cuotas_vencidas"]));
  tablero.alPublicarse(
    "alumnos.cambiaron",
    sincronizar(["cuota", "cuotas_vencidas", "documentacion_hijo", "documentacion_pendiente", "datos_incompletos"]),
  );
  // Completar o borrar un dato de un responsable cambia lo que les falta a sus alumnos. Editar las fechas o las pausas de un
  // ciclo cambia qué días tienen clases (asistencia pendiente) y cuándo termina el ciclo (ciclo por cerrar).
  tablero.alPublicarse("datos.cambiaron", async ({ dato, accion }, tx) => {
    if (dato === "padres") await avisos.sincronizar(["datos_incompletos"], tx);
    if (dato === "ciclos" && accion === "edicion") await avisos.sincronizar(["asistencia_pendiente", "ciclo_por_cerrar"], tx);
  });
  tablero.alPublicarse("documentos.cambiaron", sincronizar(["documentacion_hijo", "documentacion_pendiente"]));
  tablero.alPublicarse("asistencia.registrada", sincronizar(["asistencia_pendiente"]));
  // Reasignar un curso cambia a quién le llega el aviso de inasistencias de sus alumnos.
  tablero.alPublicarse("cursos.cambiaron", sincronizar(["asistencia_pendiente", "evaluacion_proxima", "notas_sin_publicar", "cierre_sin_publicar", "alumno_con_faltas_profesor", "evaluacion_sin_notas_profesor"]));
  tablero.alPublicarse("alertas.cambiaron", ({ reglaIds }, tx) => avisos.sincronizar([...new Set(reglaIds.flatMap((r) => TIPOS_POR_REGLA[r] ?? []))], tx));
  tablero.alPublicarse("ciclo.activado", sincronizar(TIPOS_ESTADO));
  tablero.alPublicarse("cuenta.cambio", async ({ usuarioId, rolesQuitados }, tx) => {
    if (rolesQuitados && rolesQuitados.length > 0) await avisos.borrarDeRoles(usuarioId, rolesQuitados, tx);
    await avisos.sincronizar(TIPOS_ESTADO, tx);
  });
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
  tablero.alPublicarse("alumnos.descuentoCambio", ({ cambios }, tx) => avisos.descuentoCambiado(cambios, tx));
  tablero.alPublicarse("observacion.creada", ({ observacionId }, tx) => avisos.observacionNueva(observacionId, tx));
  // Un mensaje nuevo o una conversación leída cambian los avisos de los dos lados.
  tablero.alPublicarse("chat.mensaje", sincronizar(["mensajes_familia", "mensajes_instituto"]));
  tablero.alPublicarse("chat.leido", sincronizar(["mensajes_familia", "mensajes_instituto"]));
  // Un mensaje eliminado deja de contar como sin leer.
  tablero.alPublicarse("chat.eliminado", sincronizar(["mensajes_familia", "mensajes_instituto"]));
}
