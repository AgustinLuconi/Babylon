// Los avisos de la campana de "alumno en riesgo" y "evaluación sin notas": a quién le llegan, qué dicen, que siguen al profesor
// actual del curso, que se resuelven con la alerta, que la familia nunca los recibe y que respetan las preferencias.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { REGLA_IDS } from "../src/modules/automatizaciones/automatizacion.entity";
import { textoDeAlertaDeRiesgo, textoDeEvaluacionSinNotas } from "../src/modules/notificaciones/notificacion.alertas";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const TIPOS = ["alumno_en_riesgo", "evaluacion_sin_notas", "evaluacion_sin_notas_profesor"] as const;
type Tipo = (typeof TIPOS)[number];
const revisar = () => uow.runInTransaction((tx) => container.automatizacionService.evaluar(REGLA_IDS, tx));
const avisos = (tipo: Tipo, usuarioId: string, rol: string) => prisma.notificacion.findMany({ where: { tipo, usuarioId, rol: rol as never, clave: { contains: `${P}-` } } });
const abiertos = async (tipo: Tipo, usuarioId: string, rol: string) => (await avisos(tipo, usuarioId, rol)).filter((a) => a.resueltaEn === null);
const hoy = new Date();
const haceDias = (n: number) => new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() - n));
const dd = (f: Date) => `${String(f.getUTCDate()).padStart(2, "0")}/${String(f.getUTCMonth() + 1).padStart(2, "0")}`;

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  try {
    const cfg = (regla: string, umbral: number) => prisma.automatizacion.upsert({ where: { regla }, update: { activa: true, umbral }, create: { regla, activa: true, umbral } });
    await cfg("deuda_cuotas", 2);
    await cfg("inasistencias_seguidas", 3);
    await cfg("evaluacion_sin_notas", 7);
    await cfg("alumno_en_riesgo", 1);
    await prisma.cuota.createMany({
      data: [1, 2].map((i) => ({ id: `${P}-q${i}`, alumnoId: m.hijo1, mes: i, anio: 2080, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado: "vencida" as const })),
    });
    for (const d of [1, 2, 3]) await prisma.asistencia.create({ data: { id: `${P}-as${d}`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: new Date(Date.UTC(2020, 0, d)), estado: "ausente" } });
    const fecha = haceDias(8);
    await prisma.evaluacion.create({ data: { id: `${P}-ev1`, cursoId: m.cursoId, nombre: "Pruebaav examen", tipo: "examen", fecha, periodo: "julio", estado: "borrador" } });
    await revisar();

    const nombreHijo1 = "Tomasav Pruebaav";
    // Riesgo: administración y secretaría, no profesores ni familias
    for (const [quien, cuenta, rol] of [["admin", m.admin, "admin"], ["secretaría", m.secre, "secretario"]] as const) {
      const a = await abiertos("alumno_en_riesgo", cuenta, rol);
      ok(`riesgo: ${quien} recibe un aviso con texto, tono y enlace al alumno`, `${a.length} ${a[0]?.texto}|${a[0]?.tono}|${JSON.stringify(a[0]?.recurso)}|${a[0]?.clave}`, `1 ${textoDeAlertaDeRiesgo(nombreHijo1)}|danger|${JSON.stringify({ tipo: "alumno", alumnoId: m.hijo1 })}|alerta:alumno_en_riesgo:${m.hijo1}`);
    }
    ok("riesgo: profesores y familias no reciben nada", (await avisos("alumno_en_riesgo", m.profe, "profesor")).length + (await avisos("alumno_en_riesgo", m.padre, "padre")).length + (await avisos("alumno_en_riesgo", m.ajeno, "padre")).length, 0);

    // Evaluación sin notas: staff y el profesor actual del curso
    const textoEv = textoDeEvaluacionSinNotas("Pruebaav examen", "Pruebaav Kids", dd(fecha));
    for (const [quien, cuenta, rol] of [["admin", m.admin, "admin"], ["secretaría", m.secre, "secretario"]] as const) {
      const a = await abiertos("evaluacion_sin_notas", cuenta, rol);
      ok(`sin notas: ${quien} recibe el aviso`, `${a.length} ${a[0]?.texto} ${a[0]?.nivel} ${a[0]?.clave}`, `1 ${textoEv} 1 alerta:evaluacion_sin_notas:${P}-ev1`);
    }
    const delProfe = await abiertos("evaluacion_sin_notas_profesor", m.profe, "profesor");
    const recurso = delProfe[0]?.recurso as { tipo?: string; cursoId?: string; evaluacionId?: string } | undefined; // jsonb reordena las claves
    ok("sin notas: el profesor del curso recibe el suyo con enlace a la evaluación", `${delProfe.length} ${recurso?.tipo} ${recurso?.cursoId === m.cursoId} ${recurso?.evaluacionId}`, `1 evaluacion true ${P}-ev1`);
    ok("sin notas: otro profesor, la familia y la administración (como profesor) no reciben el del profesor", (await avisos("evaluacion_sin_notas_profesor", m.multi, "profesor")).length + (await avisos("evaluacion_sin_notas_profesor", m.padre, "padre")).length + (await avisos("evaluacion_sin_notas_profesor", m.admin, "admin")).length, 0);
    ok("sin notas: la familia no recibe el de la administración", (await avisos("evaluacion_sin_notas", m.padre, "padre")).length + (await avisos("evaluacion_sin_notas", m.ajeno, "padre")).length, 0);

    // Reasignar el curso: el aviso sigue al profesor actual
    await container.cursoService.actualizarCurso(m.cursoId, { profesorId: m.profesorMultiId });
    ok("reasignar el curso: el profesor anterior pierde el aviso y el nuevo lo recibe", `${(await abiertos("evaluacion_sin_notas_profesor", m.profe, "profesor")).length} ${(await abiertos("evaluacion_sin_notas_profesor", m.multi, "profesor")).length}`, "0 1");

    // Se resuelven con la alerta
    await prisma.calificacion.create({ data: { id: `${P}-nota`, evaluacionId: `${P}-ev1`, alumnoId: m.hijo1, nota: "7" } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["evaluacion_sin_notas"], tx));
    ok("al cargar una nota los avisos de la evaluación se resuelven", `${(await abiertos("evaluacion_sin_notas", m.admin, "admin")).length} ${(await abiertos("evaluacion_sin_notas_profesor", m.multi, "profesor")).length}`, "0 0");
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo1 }, data: { estado: "pagada" } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas"], tx));
    ok("al saldar la deuda se resuelve el aviso de riesgo", (await abiertos("alumno_en_riesgo", m.admin, "admin")).length, 0);

    // Preferencias
    const prefs = async (cuenta: string, rol: string) => (await container.notificacionService.preferencias({ usuarioId: cuenta, rol: rol as never })).map((p) => p.tipo);
    const filtrar = (ts: string[]) => ts.filter((t) => (TIPOS as readonly string[]).includes(t)).sort().join(",");
    ok("preferencias: administración y secretaría listan riesgo y evaluación sin notas", `${filtrar(await prefs(m.admin, "admin"))} | ${filtrar(await prefs(m.secre, "secretario"))}`, "alumno_en_riesgo,evaluacion_sin_notas | alumno_en_riesgo,evaluacion_sin_notas");
    ok("preferencias: el profesor, la suya; la familia, ninguna", `${filtrar(await prefs(m.multi, "profesor"))} | ${filtrar(await prefs(m.padre, "padre"))}`, "evaluacion_sin_notas_profesor | ");
    await prisma.calificacion.delete({ where: { id: `${P}-nota` } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["evaluacion_sin_notas"], tx));
    ok("al borrarse la nota vuelve el aviso (otra vez abierto)", (await abiertos("evaluacion_sin_notas", m.admin, "admin")).length, 1);
    await container.notificacionService.cambiarPreferencia({ usuarioId: m.admin, rol: "admin" }, "evaluacion_sin_notas", false);
    ok("apagar el tipo borra el aviso de administración y deja el de secretaría", `${(await avisos("evaluacion_sin_notas", m.admin, "admin")).length} ${(await abiertos("evaluacion_sin_notas", m.secre, "secretario")).length}`, "0 1");
    await container.notificacionService.cambiarPreferencia({ usuarioId: m.admin, rol: "admin" }, "evaluacion_sin_notas", true);
    ok("encenderlo lo vuelve a crear en el momento", (await abiertos("evaluacion_sin_notas", m.admin, "admin")).length, 1);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    ok("limpieza: no quedan avisos de estos tipos sobre datos de prueba", await prisma.notificacion.count({ where: { tipo: { in: [...TIPOS] }, clave: { contains: `${P}-` } } }), 0);
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(REGLA_IDS, tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
