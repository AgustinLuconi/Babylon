import { randomUUID } from "node:crypto";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { CanalEnVivo, Rol, SenalEnVivo } from "../src/core/ports";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import type { TipoEstado } from "../src/modules/notificaciones/notificacion.entity";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

class CanalDePrueba implements CanalEnVivo {
  conectados = new Set<string>();
  senales: string[] = [];
  registrar() {
    return () => {};
  }
  enviarA(usuarioId: string, rol: Rol, s: SenalEnVivo) {
    this.senales.push(`${usuarioId}|${rol}|${(s.datos as { noLeidas: number }).noLeidas}`);
  }
  conectado(usuarioId: string, rol: Rol) {
    return this.conectados.has(`${usuarioId}|${rol}`);
  }
  async revisarSesiones() {}
}

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const canal = new CanalDePrueba();
const servicio = new NotificacionService(
  new PrismaNotificacionRepository(prisma),
  new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma)),
  canal,
  uow,
);
const AHORA = new Date("2026-10-15T18:00:00Z");
const esperar = () => new Promise((r) => setTimeout(r, 100));
const sync = (tipos: TipoEstado[]) => uow.runInTransaction((tx) => servicio.sincronizar(tipos, tx, AHORA));
const fila = (usuarioId: string, clave: string, rol?: Rol) =>
  prisma.notificacion.findFirst({ where: { usuarioId, clave, ...(rol ? { rol } : {}) } });
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
const cuota = (id: string, alumnoId: string, mes: number, vence: string, estado: "pendiente" | "vencida") =>
  prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId, mes, anio: 2026, montoBase: 10000, descuento: 0, montoFinal: 10000, vencimiento: new Date(`${vence}T00:00:00Z`), estado } });
const observacion = (alumnoId: string, autor: string) =>
  prisma.observacion.create({ data: { id: `${P}-obs-${randomUUID()}`, alumnoId, emisorId: autor, emisorRol: "profesor", fecha: new Date(), texto: "x", categoria: "academico" } });

(async () => {
  const m = await crearMundo(prisma);
  const padre = { usuarioId: m.padre, rol: "padre" as const };
  const admin = { usuarioId: m.admin, rol: "admin" as const };
  canal.conectados.add(`${m.padre}|padre`);

  // 1) Nace el aviso de la cuota por vencer y sale la señal después de confirmar
  await cuota("c1", m.hijo1, 10, "2026-10-18", "pendiente");
  await sync(["cuota"]);
  await esperar();
  const c1 = await fila(m.padre, `cuota:${P}-c1`);
  ok("1: aviso creado, sin leer", `${c1?.tono} ${c1?.leidaEn}`, "warning null");
  ok("1: señal al padre conectado", canal.senales.at(-1), `${m.padre}|padre|1`);

  // 2) Sincronizar de nuevo sin cambios no toca nada ni manda señales
  const senalesAntes = canal.senales.length;
  await sync(["cuota"]);
  await esperar();
  ok("2: misma fecha de actualización", (await fila(m.padre, `cuota:${P}-c1`))?.actualizadaEn.getTime(), c1?.actualizadaEn.getTime());
  ok("2: sin señales nuevas", canal.senales.length, senalesAntes);

  // 3) Marcar leída manda el número nuevo
  await servicio.marcarLeida(padre, c1!.id);
  ok("3: queda leída", (await fila(m.padre, `cuota:${P}-c1`))?.leidaEn !== null ? "sí" : "no", "sí");
  ok("3: señal con 0 sin leer", canal.senales.at(-1), `${m.padre}|padre|0`);

  // 4) Vence: misma fila, roja y otra vez sin leer
  await prisma.cuota.update({ where: { id: `${P}-c1` }, data: { estado: "vencida" } });
  await sync(["cuota"]);
  const c1v = await fila(m.padre, `cuota:${P}-c1`);
  ok("4: misma fila", c1v?.id, c1?.id);
  ok("4: roja y sin leer", `${c1v?.tono} ${c1v?.leidaEn}`, "danger null");

  // 5) Se paga: se resuelve, sale de la campana y queda en el historial
  await prisma.cuota.update({ where: { id: `${P}-c1` }, data: { estado: "pagada" } });
  await sync(["cuota"]);
  ok("5: resuelta", (await fila(m.padre, `cuota:${P}-c1`))?.resueltaEn !== null ? "sí" : "no", "sí");
  ok("5: fuera de la campana", (await servicio.campana(padre)).avisos.some((a) => a.id === c1?.id) ? "sí" : "no", "no");
  const enHistorial = (await servicio.historial(padre, "todas", undefined, AHORA)).avisos.find((a) => a.id === c1?.id);
  ok("5: en el historial, marcada resuelta", enHistorial?.resuelta ? "sí" : "no", "sí");

  // 6) Agrupado: vuelve a no leído solo cuando el número sube
  await sync(["cuotas_vencidas"]);
  const grupo = await fila(m.admin, "cuotas-vencidas");
  await servicio.marcarLeida(admin, grupo!.id);
  await cuota("c2", m.hijo2, 9, "2026-09-10", "vencida");
  await sync(["cuotas_vencidas"]);
  const grupoMas = await fila(m.admin, "cuotas-vencidas");
  ok("6: el número sube", grupoMas?.nivel, grupo!.nivel + 1);
  ok("6: vuelve a no leído", grupoMas?.leidaEn, null);
  await servicio.marcarLeida(admin, grupo!.id);
  await prisma.cuota.delete({ where: { id: `${P}-c2` } });
  await sync(["cuotas_vencidas"]);
  const grupoMenos = await fila(m.admin, "cuotas-vencidas");
  ok("6: el número baja", grupoMenos?.nivel, grupo!.nivel);
  ok("6: sigue leído", grupoMenos?.leidaEn !== null ? "sí" : "no", "sí");

  // 7) Preferencias
  const prefs = await servicio.preferencias(padre);
  ok("7: el padre ve sus 6 tipos, encendidos", `${prefs.length} ${prefs.every((p) => p.activa)}`, "6 true");
  // Vencida: su aviso existe tanto con la fecha fija de la prueba (sincronizar) como con la hora real (encender una
  // preferencia sincroniza con la hora real). Una "por vencer" solo coincide en las dos fechas por casualidad.
  await cuota("c3", m.hijo2, 10, "2026-10-10", "vencida");
  await sync(["cuota"]);
  await servicio.cambiarPreferencia(padre, "cuota", false);
  ok("7: apagar borra los avisos del tipo", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "cuota" } }), 0);
  await sync(["cuota"]);
  ok("7: apagado no se vuelven a crear", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "cuota" } }), 0);
  await servicio.cambiarPreferencia(padre, "cuota", true);
  ok("7: al encender vuelven los vigentes", (await fila(m.padre, `cuota:${P}-c3`)) ? "sí" : "no", "sí");
  ok("7: un tipo de otro rol se rechaza", await rechazo(servicio.cambiarPreferencia(padre, "cuotas_vencidas", false)), "ValidationError");

  // 8) Cuenta con dos roles: avisos y lecturas separados
  await prisma.evaluacion.create({ data: { id: `${P}-e3`, cursoId: m.cursoMultiId, nombre: "Unit 3", tipo: "examen", fecha: new Date("2026-11-20T00:00:00Z"), periodo: "noviembre", estado: "borrador" } });
  await prisma.calificacion.create({ data: { id: `${P}-cal3`, evaluacionId: `${P}-e3`, alumnoId: m.alumnoAjeno, nota: "7" } });
  await sync(["cuotas_vencidas", "notas_sin_publicar"]);
  const comoAdmin = await fila(m.multi, "cuotas-vencidas", "admin");
  const comoProfesora = await fila(m.multi, `notas-sin-publicar:${P}-e3`, "profesor");
  ok("8: tiene su aviso como admin", comoAdmin ? "sí" : "no", "sí");
  ok("8: y otro como profesora", comoProfesora ? "sí" : "no", "sí");
  ok("8: no puede marcar el de admin desde el rol profesor", await rechazo(servicio.marcarLeida({ usuarioId: m.multi, rol: "profesor" }, comoAdmin!.id)), "EntityNotFoundError");
  await servicio.marcarLeida({ usuarioId: m.multi, rol: "admin" }, comoAdmin!.id);
  ok("8: el de profesora sigue sin leer", (await fila(m.multi, `notas-sin-publicar:${P}-e3`, "profesor"))?.leidaEn, null);
  ok("8: otra cuenta no puede marcarlo", await rechazo(servicio.marcarLeida(padre, comoProfesora!.id)), "EntityNotFoundError");

  // 9) Eventos: una sola vez, y nada si la operación se deshace
  const o1 = await observacion(m.hijo1, m.profe);
  await uow.runInTransaction((tx) => servicio.observacionNueva(o1.id, tx));
  await uow.runInTransaction((tx) => servicio.observacionNueva(o1.id, tx));
  ok("9: una sola fila por evento", await prisma.notificacion.count({ where: { clave: `observacion:${o1.id}` } }), 1);
  const o2 = await observacion(m.hijo1, m.profe);
  const antesDeDeshacer = canal.senales.length;
  await uow.runInTransaction(async (tx) => {
    await servicio.observacionNueva(o2.id, tx);
    throw new Error("se deshace");
  }).catch(() => {});
  await esperar();
  ok("9: deshecha no deja aviso", await prisma.notificacion.count({ where: { clave: `observacion:${o2.id}` } }), 0);
  ok("9: deshecha no manda señal", canal.senales.length, antesDeDeshacer);

  // 10) Dos sincronizaciones a la vez del mismo tipo no chocan
  await prisma.notificacion.deleteMany({ where: { clave: "cuotas-vencidas", usuarioId: { startsWith: P } } });
  const simultaneas = await Promise.all([sync(["cuotas_vencidas"]), sync(["cuotas_vencidas"])].map(rechazo));
  ok("10: las dos terminan bien", simultaneas.join(), "ok,ok");
  ok("10: una sola fila", await prisma.notificacion.count({ where: { clave: "cuotas-vencidas", usuarioId: m.admin } }), 1);

  // 11) Campana: hasta 10, primero los no leídos; historial de a 50 con cursor
  for (let i = 0; i < 55; i++) {
    const o = await observacion(m.hijo2, m.profe);
    await uow.runInTransaction((tx) => servicio.observacionNueva(o.id, tx));
  }
  const campana = await servicio.campana(padre);
  ok("11: la campana muestra 10", campana.avisos.length, 10);
  ok("11: el número cuenta todos los no leídos", campana.noLeidas, await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "padre", leidaEn: null, resueltaEn: null } }));
  ok("11: primero los no leídos", campana.avisos.every((a) => !a.leida) ? "sí" : "no", "sí");
  const pagina1 = await servicio.historial(padre, "todas");
  ok("11: primera página de 50", pagina1.avisos.length, 50);
  const pagina2 = await servicio.historial(padre, "todas", pagina1.siguiente!);
  ok("11: la segunda trae el resto", pagina1.avisos.length + pagina2.avisos.length, await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "padre" } }));
  ok("11: sin repetidos", new Set([...pagina1.avisos, ...pagina2.avisos].map((a) => a.id)).size, pagina1.avisos.length + pagina2.avisos.length);
  ok("11: la última página no tiene siguiente", pagina2.siguiente, null);
  const pendientes = await servicio.historial(padre, "pendientes", undefined, AHORA);
  ok("11: 'pendientes' solo trae estado abierto", pendientes.avisos.every((a) => !a.resuelta && a.tipo === "cuota") ? "sí" : "no", "sí");

  // 12) Leer todas
  ok("12: marca todas", (await servicio.leerTodas(padre)) > 50 ? "sí" : "no", "sí");
  ok("12: queda en cero", (await servicio.campana(padre)).noLeidas, 0);

  // 13) Limpieza a los 30 días: se van los eventos y los resueltos viejos; los de estado abiertos se quedan
  const viejo = new Date(AHORA.getTime() - 31 * 24 * 60 * 60 * 1000);
  // (el aviso de c1 se borró al apagar el tipo en el paso 7: se arma otro resuelto)
  await cuota("c4", m.hijo1, 11, "2026-10-19", "pendiente");
  await sync(["cuota"]);
  await prisma.cuota.update({ where: { id: `${P}-c4` }, data: { estado: "pagada" } });
  await sync(["cuota"]);
  await prisma.notificacion.updateMany({ where: { clave: `cuota:${P}-c4` }, data: { actualizadaEn: viejo } }); // resuelta
  await prisma.notificacion.updateMany({ where: { clave: `observacion:${o1.id}` }, data: { actualizadaEn: viejo } });
  await prisma.notificacion.updateMany({ where: { clave: `cuota:${P}-c3` }, data: { actualizadaEn: viejo } }); // abierta
  await servicio.limpiar(AHORA);
  ok("13: el resuelto viejo se borra", (await fila(m.padre, `cuota:${P}-c4`)) ? "sigue" : "borrado", "borrado");
  ok("13: el evento viejo se borra", (await fila(m.padre, `observacion:${o1.id}`)) ? "sigue" : "borrado", "borrado");
  ok("13: el de estado abierto se queda", (await fila(m.padre, `cuota:${P}-c3`)) ? "sigue" : "borrado", "sigue");

  await limpiarMundo(prisma);
  await servicio.sincronizarTodo();
  ok("limpieza", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
