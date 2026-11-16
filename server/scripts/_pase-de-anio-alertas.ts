// Pase de año con "activar el ciclo nuevo": la deuda de un alumno que pasa no cambia, así que su alerta sigue siendo la misma
// fila (no se cierra y reabre) y su aviso ya leído no vuelve a "no leído".
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { paseDeAnioSchema } from "../src/modules/ciclos/paseDeAnio.schema";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  const activoOriginal = m.cicloId;
  try {
    await prisma.automatizacion.upsert({ where: { regla: "deuda_cuotas" }, update: { activa: true, umbral: 2 }, create: { regla: "deuda_cuotas", activa: true, umbral: 2 } });
    const [origen, destino] = [`${P}-ciclo-2098`, `${P}-ciclo-2099`];
    await prisma.ciclo.create({ data: { id: origen, anio: 2098, activo: false } });
    await prisma.ciclo.create({ data: { id: destino, anio: 2099, activo: false } });
    // El ciclo de origen es el activo (como a fin de año): el alumno con deuda está inscripto en él.
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: origen }, data: { activo: true } });
    const curso = `${P}-cdeuda`;
    await prisma.curso.create({ data: { id: curso, nombre: "Pruebaav deuda", nivel: "kids", profesorId: m.profesorId, cicloId: origen, cupo: 10, estado: "activo" } });
    const alumno = `${P}-deudor`;
    await prisma.alumno.create({ data: { id: alumno, nombre: "Deudorav", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreAjenoId, cursoId: curso, aplicaDescuentoHermanos: false } });
    await prisma.inscripcion.create({ data: { id: `${alumno}-i`, alumnoId: alumno, cursoId: curso, cicloId: origen, fecha: new Date(), aplicaDescuentoHermanos: false } });
    for (const mes of [1, 2]) await prisma.cuota.create({ data: { id: `${P}-q${mes}`, alumnoId: alumno, mes, anio: 2080, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado: "vencida" } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas"], tx));

    const alerta = await prisma.alertaAutomatica.findFirstOrThrow({ where: { regla: "deuda_cuotas", alumnoId: alumno, resueltaEn: null } });
    const aviso = await prisma.notificacion.findFirstOrThrow({ where: { tipo: "alumno_con_deuda", usuarioId: m.admin, clave: `alerta:deuda_cuotas:${alumno}` } });
    await prisma.notificacion.update({ where: { id: aviso.id }, data: { leidaEn: new Date() } });

    // El pase: el alumno pasa a la copia de su curso y se activa el ciclo nuevo.
    await container.paseDeAnioService.confirmar(
      paseDeAnioSchema.parse({ origenId: origen, destino: { cicloId: destino }, copiarCursoIds: [curso], cursos: [{ cursoOrigenId: curso, destino: { tipo: "copia", copiaDe: curso } }], cierre: { activarDestino: true, bloquearOrigen: false } }),
    );
    ok("el pase activó el ciclo nuevo", (await prisma.ciclo.findUniqueOrThrow({ where: { id: destino } })).activo, true);
    const filas = await prisma.alertaAutomatica.findMany({ where: { regla: "deuda_cuotas", alumnoId: alumno } });
    ok("la deuda no cambió: sigue una sola alerta, la misma fila y abierta", `${filas.length} ${filas[0]?.id === alerta.id} ${filas[0]?.resueltaEn}`, "1 true null");
    const despues = await prisma.notificacion.findUniqueOrThrow({ where: { id: aviso.id } });
    ok("el aviso ya leído sigue leído y abierto", `${despues.leidaEn !== null} ${despues.resueltaEn}`, "true null");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: activoOriginal }, data: { activo: true } });
    await limpiarMundo(prisma);
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas", "inasistencias_seguidas"], tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
