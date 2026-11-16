// Orden de los bloqueos: guardar una asistencia que cambia una alerta toma (regla → avisos alumno_con_* → resto) y editar un
// curso toma (alumno_con_faltas_profesor → resto): no pueden trabarse entre sí. Se fuerza el cruce reteniendo un bloqueo.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  try {
    await prisma.automatizacion.upsert({ where: { regla: "inasistencias_seguidas" }, update: { activa: true, umbral: 3 }, create: { regla: "inasistencias_seguidas", activa: true, umbral: 3 } });
    for (const d of [1, 2]) await prisma.asistencia.create({ data: { id: `${P}-as${d}`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: new Date(Date.UTC(2020, 0, d)), estado: "ausente" } });

    // H hace de "editar un curso": retiene el bloqueo del aviso del profesor y, más tarde, pide el de asistencia pendiente.
    let retenido!: () => void;
    const yaRetiene = new Promise<void>((r) => (retenido = r));
    let soltar!: () => void;
    const compuerta = new Promise<void>((r) => (soltar = r));
    const h = uow
      .runInTransaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('avisos:alumno_con_faltas_profesor', 0))`;
        retenido();
        await compuerta;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('avisos:asistencia_pendiente', 0))`;
      })
      .then(() => "ok", (e) => mensaje(e));
    await yaRetiene;

    // A guarda la tercera ausencia seguida: abre la alerta y sincroniza los avisos (queda esperando a H).
    const a = container.asistenciaService
      .registrarAsistenciaMasiva(registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha: "2026-01-10", registros: [{ alumnoId: m.hijo1, estado: "ausente" }] }), m.profesorId)
      .then(() => "ok", (e) => mensaje(e));
    await espera(700);
    soltar();
    const [resH, resA] = await Promise.all([h, a]);
    ok("editar un curso (H) no se traba con guardar la asistencia", resH, "ok");
    ok("guardar la asistencia (A) no se traba con editar un curso", resA, "ok");
    ok("la alerta de inasistencias quedó abierta", await prisma.alertaAutomatica.count({ where: { regla: "inasistencias_seguidas", alumnoId: m.hijo1, resueltaEn: null } }), 1);
  } catch (e) {
    ok("sin excepciones", mensaje(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas", "inasistencias_seguidas"], tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
