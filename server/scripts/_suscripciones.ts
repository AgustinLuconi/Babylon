import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import type { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { suscribirAvisos } from "../src/modules/notificaciones/notificacion.suscripciones";
import { ok } from "./_check";

const llamadas: string[] = [];
const falso = {
  sincronizar: async (tipos: string[]) => void llamadas.push(`sync ${[...tipos].sort().join(",")}`),
  notasPublicadas: async (id: string, alumnos: string[] | null) => void llamadas.push(`notas ${id} ${alumnos?.join("+") ?? "todas"}`),
  cierrePublicado: async (id: string) => void llamadas.push(`cierre ${id}`),
  observacionNueva: async (id: string) => void llamadas.push(`observacion ${id}`),
} as unknown as NotificacionService;
const tablero = new TableroDeAnuncios<EventosDelSistema>();
suscribirAvisos(tablero, falso);
const TODOS = "sync alumno_con_deuda,alumno_con_faltas,alumno_con_faltas_profesor,alumno_en_riesgo,asistencia_pendiente,ciclo_por_cerrar,cierre_sin_publicar,cuota,cuotas_vencidas,datos_incompletos,documentacion_hijo,documentacion_pendiente,evaluacion_proxima,evaluacion_sin_notas,evaluacion_sin_notas_profesor,mensajes_familia,mensajes_instituto,notas_sin_publicar";

const prueba = async <K extends keyof EventosDelSistema & string>(nombre: K, datos: EventosDelSistema[K], esperado: string) => {
  llamadas.length = 0;
  await tablero.publicar(nombre, datos);
  ok(nombre, llamadas.join(" / "), esperado);
};

(async () => {
  await prueba("cuotas.cambiaron", { motivo: "pago" }, "sync cuota,cuotas_vencidas");
  await prueba("alumnos.cambiaron", { alumnoId: "a1" }, "sync cuota,cuotas_vencidas,datos_incompletos,documentacion_hijo,documentacion_pendiente");
  // Editar un responsable cambia lo que les falta a sus alumnos; otros cambios de datos no revisan nada.
  await prueba("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: ["p1"] } }, "sync datos_incompletos");
  await prueba("datos.cambiaron", { dato: "cursos", accion: "edicion", ids: { cursoIds: ["c1"] } }, "");
  await prueba("documentos.cambiaron", { alumnoId: "a1" }, "sync documentacion_hijo,documentacion_pendiente");
  await prueba("asistencia.registrada", { cursoId: "c1" }, "sync asistencia_pendiente");
  await prueba("cursos.cambiaron", { cursoId: "c1" }, "sync alumno_con_faltas_profesor,asistencia_pendiente,cierre_sin_publicar,evaluacion_proxima,evaluacion_sin_notas_profesor,notas_sin_publicar");
  await prueba("ciclo.activado", { cicloId: "x" }, TODOS);
  await prueba("cuenta.cambio", { usuarioId: "u1" }, TODOS);
  await prueba("evaluacion.creada", { evaluacionId: "e1" }, "sync evaluacion_proxima");
  await prueba("evaluacion.publicada", { evaluacionId: "e1" }, "sync notas_sin_publicar / notas e1 todas");
  await prueba("calificaciones.cargadas", { evaluacionId: "e1", alumnoIds: ["a1", "a2"] }, "sync notas_sin_publicar / notas e1 a1+a2");
  await prueba("cierre.cargado", { notaCierreIds: ["n1", "n2"] }, "sync cierre_sin_publicar");
  // Un lote publicado sincroniza una sola vez y crea un aviso por nota.
  await prueba("cierre.publicado", { notaCierreIds: ["n1", "n2"] }, "sync cierre_sin_publicar / cierre n1 / cierre n2");
  await prueba("observacion.creada", { observacionId: "o1" }, "observacion o1");
  await prueba("chat.mensaje", { chatId: "c1", padreId: "p1", usuarioIdPadre: "u1" }, "sync mensajes_familia,mensajes_instituto");
  await prueba("chat.leido", { chatId: "c1", padreId: "p1", usuarioIdPadre: "u1" }, "sync mensajes_familia,mensajes_instituto");
  await prueba("sesiones.cerradas", { usuarioId: "u1", motivo: "vencida" }, "");
})();
