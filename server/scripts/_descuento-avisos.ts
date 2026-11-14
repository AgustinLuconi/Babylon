import { PrismaClient } from "@prisma/client";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { CanalEnVivo } from "../src/core/ports";
import type { EventosDelSistema } from "../src/eventos";
import type { CambioDeDescuento } from "../src/modules/alumnos/alumno.eventos";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { textoDeAvisoDeDescuento } from "../src/modules/notificaciones/notificacion.descuento";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { suscribirAvisos } from "../src/modules/notificaciones/notificacion.suscripciones";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const canal: CanalEnVivo = { registrar: () => () => {}, enviarA: () => {}, enviarARoles: () => {}, conectado: () => false, revisarSesiones: async () => {} };
const repoAvisos = new PrismaNotificacionRepository(prisma);
const avisos = new NotificacionService(repoAvisos, new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma)), canal, uow);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
suscribirAvisos(tablero, avisos);

const publicar = (cambios: CambioDeDescuento[]) => uow.runInTransaction((tx) => tablero.publicar("alumnos.descuentoCambio", { cambios }, tx));
const delAlumno = (usuarioId: string, rol: string, alumnoId: string) =>
  prisma.notificacion.findMany({ where: { usuarioId, rol: rol as never, clave: { startsWith: `descuento:${alumnoId}:` } }, orderBy: { creadaEn: "asc" } });
const limpiarAvisos = () => prisma.notificacion.deleteMany({ where: { usuarioId: { startsWith: P }, tipo: { in: ["descuento_hermanos", "descuento_hermanos_instituto"] } } });

(async () => {
  const m = await crearMundo(prisma);
  const hijo1 = `${P}-hijo1`;
  const hijo2 = `${P}-hijo2`;
  const nombre = async (id: string) => {
    const a = await prisma.alumno.findUniqueOrThrow({ where: { id } });
    return `${a.nombre} ${a.apellido}`;
  };
  const [n1, n2] = [await nombre(hijo1), await nombre(hijo2)];

  // Baja del hermano 1: el 2 pasa a pagar completo
  await publicar([{ alumnoId: hijo2, aplica: false, causa: "baja", alumnoDeLaCausaId: hijo1 }]);
  const texto = textoDeAvisoDeDescuento({ destinatario: "instituto", alumno: n2, aplica: false, causa: "baja", alumnoDeLaCausa: n1, esElQueSeMovio: false });
  for (const [quien, rol, cuenta] of [["admin", "admin", m.admin], ["secretaría", "secretario", m.secre]] as const) {
    const a = await delAlumno(cuenta, rol, hijo2);
    ok(`${quien}: un aviso`, a.length, 1);
    ok(`${quien}: tipo de instituto`, a[0]?.tipo, "descuento_hermanos_instituto");
    ok(`${quien}: clase evento`, a[0]?.clase, "evento");
    ok(`${quien}: texto`, a[0]?.texto, texto);
    ok(`${quien}: lleva al legajo`, JSON.stringify(a[0]?.recurso), JSON.stringify({ tipo: "alumno", alumnoId: hijo2 }));
  }
  const delPadre = await delAlumno(m.padre, "padre", hijo2);
  ok("el padre con cuenta recibe un aviso", delPadre.length, 1);
  ok("tipo de familia", delPadre[0]?.tipo, "descuento_hermanos");
  ok("texto de la familia", delPadre[0]?.texto, textoDeAvisoDeDescuento({ destinatario: "familia", alumno: n2, aplica: false, causa: "baja", alumnoDeLaCausa: n1, esElQueSeMovio: false }));
  ok("lleva a la pantalla del hijo", JSON.stringify(delPadre[0]?.recurso), JSON.stringify({ tipo: "hijo", alumnoId: hijo2 }));
  ok("la otra familia no recibe nada", (await prisma.notificacion.count({ where: { usuarioId: m.ajeno, tipo: { in: ["descuento_hermanos", "descuento_hermanos_instituto"] } } })), 0);

  // Un cambio posterior del mismo alumno avisa otra vez (la clave lleva el momento)
  await new Promise((r) => setTimeout(r, 15));
  await publicar([{ alumnoId: hijo2, aplica: true, causa: "reactivacion", alumnoDeLaCausaId: hijo1 }]);
  ok("otro cambio: otro aviso para el padre", (await delAlumno(m.padre, "padre", hijo2)).length, 2);

  // Cambio de responsable: la familia no ve el nombre de quien no es suyo
  await limpiarAvisos();
  const ajeno = `${P}-alumno-ajeno`;
  await publicar([{ alumnoId: hijo2, aplica: false, causa: "cambio-responsable", alumnoDeLaCausaId: ajeno }]);
  const sinNombre = (await delAlumno(m.padre, "padre", hijo2))[0];
  ok("la familia no nombra al que cambió de responsable", sinNombre?.texto.includes(await nombre(ajeno)) ? "lo nombra" : "no lo nombra", "no lo nombra");
  ok("y el instituto sí lo nombra", (await delAlumno(m.admin, "admin", hijo2))[0]?.texto.includes(await nombre(ajeno)) ? "lo nombra" : "no lo nombra", "lo nombra");

  // Alumno inactivo: sin avisos
  await limpiarAvisos();
  await prisma.alumno.update({ where: { id: hijo1 }, data: { estado: "inactivo" } });
  await publicar([{ alumnoId: hijo1, aplica: false, causa: "baja", alumnoDeLaCausaId: hijo2 }]);
  ok("un alumno inactivo no genera avisos", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P }, tipo: { in: ["descuento_hermanos", "descuento_hermanos_instituto"] } } }), 0);
  await prisma.alumno.update({ where: { id: hijo1 }, data: { estado: "activo" } });

  // Padre sin cuenta activa: sin aviso (el instituto sí)
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "inactivo" } });
  await publicar([{ alumnoId: ajeno, aplica: true, causa: "reactivacion", alumnoDeLaCausaId: hijo1 }]);
  ok("sin cuenta activa: sin aviso", (await delAlumno(m.ajeno, "padre", ajeno)).length, 0);
  ok("el instituto igual se entera", (await delAlumno(m.admin, "admin", ajeno)).length, 1);
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });

  // Preferencia apagada: sin aviso
  await limpiarAvisos();
  await repoAvisos.desactivar({ usuarioId: m.padre, rol: "padre" }, "descuento_hermanos");
  await publicar([{ alumnoId: hijo2, aplica: false, causa: "baja", alumnoDeLaCausaId: hijo1 }]);
  ok("preferencia apagada: el padre no recibe", (await delAlumno(m.padre, "padre", hijo2)).length, 0);
  ok("y el instituto sí", (await delAlumno(m.admin, "admin", hijo2)).length, 1);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
