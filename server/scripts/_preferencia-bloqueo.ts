import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import type { CanalEnVivo } from "../src/core/ports";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const canal: CanalEnVivo = { registrar: () => () => {}, enviarA: () => {}, conectado: () => false, revisarSesiones: async () => {} };
const uow = new PrismaUnitOfWork(prisma);
const repo = new PrismaNotificacionRepository(prisma);
const servicio = new NotificacionService(repo, new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma)), canal, uow);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = await crearMundo(prisma);
  // Una sincronización de "cuota" en curso (por ejemplo, la de un pago) tiene tomado el tipo durante 1 s
  let sincronizacionTermino = 0;
  const sincronizacion = uow.runInTransaction(async (tx) => {
    await repo.bloquearTipos(["cuota"], tx);
    await esperar(1000);
    sincronizacionTermino = Date.now();
  });
  await esperar(150);
  // El padre apaga "Cuotas" mientras tanto: tiene que esperar a que termine, no meterse en el medio
  await servicio.cambiarPreferencia({ usuarioId: m.padre, rol: "padre" }, "cuota", false);
  const apagadoTermino = Date.now();
  await sincronizacion;
  ok("apagar espera a la sincronización en curso", apagadoTermino >= sincronizacionTermino ? "esperó" : "se metió en el medio", "esperó");
  ok("queda apagado", (await prisma.notificacionDesactivada.count({ where: { usuarioId: m.padre, tipo: "cuota" } })) === 1 ? "sí" : "no", "sí");
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
