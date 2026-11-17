// Orden de los bloqueos: guardar una asistencia que cambia una alerta toma (regla → avisos alumno_con_* → resto) y editar un
// curso toma (alumno_con_faltas_profesor → resto): no pueden trabarse entre sí. Se fuerza el cruce reteniendo un bloqueo.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { cargarCalificacionesSchema } from "../src/modules/calificaciones/calificacion.schema";
import { REGLA_IDS } from "../src/modules/automatizaciones/automatizacion.entity";
import { TIPOS_ESTADO } from "../src/modules/notificaciones/notificacion.tipos";
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

    // Las cuatro reglas a la vez: lo que hace un cambio de alumnos (revisar todas y sincronizar todos los avisos), cargar notas
    // (revisa evaluación sin notas) y editar un curso (idem, y avisos del profesor), 15 veces en paralelo. Todo en el orden del
    // catálogo: ningún par se traba (Postgres abortaría una de las dos con "deadlock detected").
    await prisma.evaluacion.create({ data: { id: `${P}-evb`, cursoId: m.cursoId, nombre: "Pruebaav bloqueos", tipo: "examen", fecha: new Date("2020-01-05T00:00:00Z"), periodo: "julio", estado: "borrador" } });
    const errores: string[] = [];
    const anota = (r: string) => {
      if (r !== "ok") errores.push(r);
    };
    for (let i = 0; i < 15; i++) {
      const cambioDeAlumnos = uow
        .runInTransaction(async (tx) => {
          await container.automatizacionService.evaluar(REGLA_IDS, tx);
          await container.notificacionService.sincronizar(TIPOS_ESTADO, tx);
        })
        .then(() => "ok", mensaje);
      const notas = container.calificacionService
        .cargarCalificaciones(`${P}-evb`, cargarCalificacionesSchema.parse({ notas: [{ alumnoId: m.hijo1, nota: String((i % 9) + 1) }] }), m.profesorId)
        .then(() => "ok", mensaje);
      const curso = container.cursoService.actualizarCurso(m.cursoId, { aula: `A${i}` }).then(() => "ok", mensaje);
      // Lo que hace un cambio de cuotas: revisa la deuda y, al cambiar sus alertas, el anuncio revisa el riesgo (deuda → riesgo).
      const cambioDeCuotas = uow
        .runInTransaction(async (tx) => {
          await container.automatizacionService.evaluar(["deuda_cuotas"], tx);
          await container.automatizacionService.evaluar(["alumno_en_riesgo"], tx);
        })
        .then(() => "ok", mensaje);
      (await Promise.all([cambioDeAlumnos, notas, curso, cambioDeCuotas])).forEach(anota);
    }
    ok("15 rondas de cambio de alumnos + cuotas + notas + edición de curso en paralelo, sin trabarse", errores.length === 0 ? "ok" : errores[0], "ok");
  } catch (e) {
    ok("sin excepciones", mensaje(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(REGLA_IDS, tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
