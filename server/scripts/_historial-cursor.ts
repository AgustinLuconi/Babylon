import { randomUUID } from "node:crypto";
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
const servicio = new NotificacionService(new PrismaNotificacionRepository(prisma), new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma)), canal, uow);
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);

(async () => {
  const m = await crearMundo(prisma);
  const padre = { usuarioId: m.padre, rol: "padre" as const };
  for (let i = 0; i < 55; i++) {
    const o = await prisma.observacion.create({ data: { id: `${P}-obs-${randomUUID()}`, alumnoId: m.hijo1, emisorId: m.profe, emisorRol: "profesor", fecha: new Date(), texto: "x", categoria: "academico" } });
    await uow.runInTransaction((tx) => servicio.observacionNueva(o.id, tx));
  }

  // 1) Entre página y página se actualiza el último aviso de la primera: la segunda no repite ni saltea
  const p1 = await servicio.historial(padre, "todas");
  await prisma.notificacion.update({ where: { id: p1.avisos[49].id }, data: { actualizadaEn: new Date(Date.now() + 60_000) } });
  const p2 = await servicio.historial(padre, "todas", p1.siguiente!);
  const vistos = new Set([...p1.avisos, ...p2.avisos].map((a) => a.id));
  ok("1: la segunda página trae el resto", p2.avisos.length, 5);
  ok("1: sin repetidos", vistos.size, 55);

  // 2) Filtro "no leídas": el último de la primera página se marca leído antes de pedir la segunda
  const n1 = await servicio.historial(padre, "no-leidas");
  await servicio.marcarLeida(padre, n1.avisos[49].id);
  const n2 = await servicio.historial(padre, "no-leidas", n1.siguiente!);
  ok("2: no se saltea ninguno", n1.avisos.length + n2.avisos.length, 55);

  // 3) Un marcador inválido se rechaza
  ok("3: marcador inválido", await rechazo(servicio.historial(padre, "todas", "cualquiera")), "ValidationError");

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
