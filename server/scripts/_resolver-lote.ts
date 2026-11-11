import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { CanalEnVivo } from "../src/core/ports";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

// Cuenta las sentencias UPDATE sobre "Notificacion" que manda Prisma.
const prisma = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
let updates = 0;
prisma.$on("query", (e) => {
  if (/^UPDATE "public"\."Notificacion"/.test(e.query)) updates++;
});
const canal: CanalEnVivo = { registrar: () => () => {}, enviarA: () => {}, conectado: () => false, revisarSesiones: async () => {} };
const uow = new PrismaUnitOfWork(prisma);
const servicio = new NotificacionService(new PrismaNotificacionRepository(prisma), new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma)), canal, uow);
const N = 60;

(async () => {
  const m = await crearMundo(prisma);
  const ahora = new Date();
  for (let i = 0; i < N; i++) {
    await prisma.alumno.create({ data: { id: `${P}-lote${i}`, nombre: `Lote${i}`, apellido: "Pruebaav", dni: `9940020${String(i).padStart(2, "0")}`, fechaNacimiento: new Date("2015-01-01T00:00:00Z"), fechaInscripcion: ahora, estado: "activo", padreId: m.padreId, cursoId: m.cursoId, aplicaDescuentoHermanos: false } });
    await prisma.inscripcion.create({ data: { id: `${P}-lote${i}-insc`, alumnoId: `${P}-lote${i}`, cursoId: m.cursoId, cicloId: m.cicloId, fecha: ahora, aplicaDescuentoHermanos: false } });
  }
  await uow.runInTransaction((tx) => servicio.sincronizar(["documentacion_hijo"], tx));
  ok("avisos abiertos del padre", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "documentacion_hijo", resueltaEn: null } }), N + 2);

  // Los hijos dejan de estar activos: sus avisos se resuelven de una vez, no uno por uno
  await prisma.alumno.updateMany({ where: { padreId: m.padreId }, data: { estado: "egresado" } });
  updates = 0;
  await uow.runInTransaction((tx) => servicio.sincronizar(["documentacion_hijo"], tx));
  ok("quedan resueltos", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "documentacion_hijo", resueltaEn: null } }), 0);
  ok("resolverlos lleva una sola sentencia", updates, 1);

  // Una operación larga (6 s) no se corta por el límite de tiempo de la transacción
  const larga = await uow
    .runInTransaction(async (tx) => {
      await (tx as PrismaClient).$executeRaw`SELECT pg_sleep(6)`;
      return "terminó";
    })
    .catch((e: Error) => e.constructor.name);
  ok("una transacción de 6 s termina", larga, "terminó");

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.alumno.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
