import { PrismaClient } from "@prisma/client";
import { CanalEnMemoria } from "../src/core/adapters/CanalEnMemoria";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { ejecutarComo } from "../src/core/autoria";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { Rol, SenalEnVivo } from "../src/core/ports";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaDestinatariosDeCambios } from "../src/modules/cambios/cambio.destinatarios.prisma";
import { suscribirDifusionDeCambios } from "../src/modules/cambios/cambio.difusion";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const canal = new CanalEnMemoria(async () => true);
const conectar = (sesionId: string, usuarioId: string, rol: Rol) => {
  const recibidas: string[] = [];
  canal.registrar({ sesionId, usuarioId, rol, enviar: (s: SenalEnVivo) => void recibidas.push(JSON.stringify(s)), cerrar: () => {} });
  return recibidas;
};
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const uow = new PrismaUnitOfWork(prisma);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = await crearMundo(prisma);
  suscribirDifusionDeCambios(tablero, canal, new PrismaDestinatariosDeCambios(prisma), async (id) => (await prisma.usuario.findUnique({ where: { id } }))?.nombre ?? "");
  const admin = conectar("s1", m.admin, "admin");
  const padre = conectar("s2", m.padre, "padre");
  const ajeno = conectar("s3", m.ajeno, "padre");
  const profe = conectar("s4", m.profe, "profesor");

  await ejecutarComo({ usuarioId: m.secre, rol: "secretario" }, () =>
    uow.runInTransaction((tx) => tablero.publicar("datos.cambiaron", { dato: "cuotas", accion: "cobro", ids: { alumnoIds: [m.hijo1], cuotaIds: ["c1"] } }, tx)),
  );
  await esperar(300);
  ok("al admin le llega con quién lo hizo", admin.at(-1), JSON.stringify({ tipo: "cambio", datos: { dato: "cuotas", accion: "cobro", ids: { alumnoIds: [m.hijo1], cuotaIds: ["c1"] }, por: { usuarioId: m.secre, nombre: "Pruebaav secre", rol: "secretario" } } }));
  ok("al padre del alumno también", padre.length, 1);
  ok("a otra familia no", ajeno.length, 0);
  ok("a un profesor no (las cuotas no son suyas)", profe.length, 0);
  ok("la señal no lleva el nombre del alumno", admin.join().includes("Tomasav") ? "sí" : "no", "no");

  await uow
    .runInTransaction(async (tx) => {
      await tablero.publicar("datos.cambiaron", { dato: "cuotas", accion: "cobro", ids: { alumnoIds: [m.hijo1] } }, tx);
      throw new Error("falla simulada");
    })
    .catch(() => {});
  await esperar(300);
  ok("si la transacción se deshace, no sale nada", admin.length, 1);

  await uow.runInTransaction((tx) => tablero.publicar("datos.cambiaron", { dato: "cuotas", accion: "vencimiento", ids: { alumnoIds: [m.hijo1] } }, tx));
  await esperar(300);
  ok("sin autor (una tarea automática): por es null", JSON.parse(admin.at(-1) as string).datos.por, null);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
