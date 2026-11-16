// Las reglas "alumno en riesgo" y "evaluación sin notas" contra la base (mundo de prueba): se abren, se cierran, no se duplican,
// respetan el número, y el servicio rechaza un número en la regla que no lo tiene.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { ValidationError } from "../src/core/errors";
import { REGLA_IDS } from "../src/modules/automatizaciones/automatizacion.entity";
import type { ReglaId } from "../src/modules/automatizaciones/automatizacion.reconciliar";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const servicio = container.automatizacionService;
const revisar = (reglas: ReglaId[], causa?: "revision" | "regla-apagada" | "cambio-de-numero") => uow.runInTransaction((tx) => servicio.evaluar(reglas, tx, causa));
const config = (regla: ReglaId, datos: { activa?: boolean; umbral?: number }) =>
  prisma.automatizacion.upsert({ where: { regla }, update: datos, create: { regla, activa: true, umbral: 1, ...datos } });
const hoy = new Date();
const haceDias = (n: number) => {
  const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  const idEvaluacion = (n: number) => `${P}-ev${n}`;
  const evaluacion = (n: number, cursoId: string, dias: number) =>
    prisma.evaluacion.create({ data: { id: idEvaluacion(n), cursoId, nombre: `Pruebaav examen ${n}`, tipo: "examen", fecha: haceDias(dias), periodo: "julio", estado: "borrador" } });
  const alertasDe = (regla: ReglaId, where: object) => prisma.alertaAutomatica.findMany({ where: { regla, ...where }, orderBy: { abiertaEn: "asc" } });
  const abiertasEv = async (n: number) => (await alertasDe("evaluacion_sin_notas", { evaluacionId: idEvaluacion(n) })).filter((a) => a.resueltaEn === null);
  const abiertasRiesgo = async (alumnoId: string) => (await alertasDe("alumno_en_riesgo", { alumnoId })).filter((a) => a.resueltaEn === null);
  try {
    await config("deuda_cuotas", { activa: true, umbral: 2 });
    await config("inasistencias_seguidas", { activa: true, umbral: 3 });
    await config("evaluacion_sin_notas", { activa: true, umbral: 7 });
    await config("alumno_en_riesgo", { activa: true, umbral: 1 });
    ok("el catálogo revisa las reglas en este orden (riesgo al final)", REGLA_IDS.join(","), "deuda_cuotas,inasistencias_seguidas,evaluacion_sin_notas,alumno_en_riesgo");

    // ── Evaluación sin notas ─────────────────────────────────────────────────
    await evaluacion(1, m.cursoId, 8);
    await evaluacion(2, m.cursoId, 6);
    await evaluacion(3, m.cursoId, 30);
    await prisma.calificacion.create({ data: { id: `${P}-nota1`, evaluacionId: idEvaluacion(3), alumnoId: m.hijo1, nota: "7" } });
    await revisar(["evaluacion_sin_notas"]);
    const a1 = await abiertasEv(1);
    ok("sin notas: la de hace 8 días se abre con alumno null, su curso, nivel 1", `${a1.length} ${a1[0]?.alumnoId} ${a1[0]?.cursoId === m.cursoId} ${a1[0]?.nivel}`, "1 null true 1");
    ok("sin notas: la de hace 6 días no", (await abiertasEv(2)).length, 0);
    ok("sin notas: la que tiene una nota no", (await abiertasEv(3)).length, 0);
    await revisar(["evaluacion_sin_notas"]);
    ok("revisar de nuevo no duplica", (await alertasDe("evaluacion_sin_notas", { evaluacionId: idEvaluacion(1) })).length, 1);
    await config("evaluacion_sin_notas", { umbral: 3 });
    await evaluacion(4, m.cursoId, 4);
    await revisar(["evaluacion_sin_notas"], "cambio-de-numero");
    ok("con el número en 3 se abre también la de hace 4 días", (await abiertasEv(4)).length, 1);
    await config("evaluacion_sin_notas", { umbral: 7 });
    await revisar(["evaluacion_sin_notas"], "cambio-de-numero");
    const cerrada4 = (await alertasDe("evaluacion_sin_notas", { evaluacionId: idEvaluacion(4) }))[0];
    ok("al subir el número a 7 la de hace 4 días se cierra por cambio de número", `${(await abiertasEv(4)).length} ${cerrada4.motivoCierre}`, "0 cambio-de-numero");
    await prisma.calificacion.create({ data: { id: `${P}-nota2`, evaluacionId: idEvaluacion(1), alumnoId: m.hijo1, nota: "6" } });
    await revisar(["evaluacion_sin_notas"]);
    const cerrada1 = (await alertasDe("evaluacion_sin_notas", { evaluacionId: idEvaluacion(1) }))[0];
    ok("al cargar una nota se cierra como resuelta", `${(await abiertasEv(1)).length} ${cerrada1.motivoCierre}`, "0 resuelta");
    await prisma.curso.update({ where: { id: m.cursoId }, data: { estado: "inactivo" } });
    await evaluacion(5, m.cursoId, 20);
    await revisar(["evaluacion_sin_notas"]);
    ok("un curso inactivo no alerta", (await abiertasEv(5)).length, 0);
    await prisma.curso.update({ where: { id: m.cursoId }, data: { estado: "activo" } });
    await revisar(["evaluacion_sin_notas"]);
    ok("al reactivar el curso se abre", (await abiertasEv(5)).length, 1);
    await prisma.curso.update({ where: { id: m.cursoId }, data: { estado: "inactivo" } });
    await revisar(["evaluacion_sin_notas"]);
    const cerrada5 = (await alertasDe("evaluacion_sin_notas", { evaluacionId: idEvaluacion(5) }))[0];
    ok("al desactivar el curso se cierra como ya-no-corresponde", `${(await abiertasEv(5)).length} ${cerrada5.motivoCierre}`, "0 ya-no-corresponde");
    await prisma.curso.update({ where: { id: m.cursoId }, data: { estado: "activo" } });

    // ── Alumno en riesgo ─────────────────────────────────────────────────────
    await prisma.cuota.createMany({
      data: [1, 2].map((i) => ({ id: `${P}-q${i}`, alumnoId: m.hijo2, mes: i, anio: 2080, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado: "vencida" as const })),
    });
    await revisar(["deuda_cuotas", "inasistencias_seguidas", "alumno_en_riesgo"]);
    ok("solo con deuda no hay riesgo", (await abiertasRiesgo(m.hijo2)).length, 0);
    for (const d of [1, 2, 3]) await prisma.asistencia.create({ data: { id: `${P}-as${d}`, alumnoId: m.hijo2, cursoId: m.cursoId, fecha: new Date(Date.UTC(2020, 0, d)), estado: "ausente" } });
    await revisar(["deuda_cuotas", "inasistencias_seguidas", "alumno_en_riesgo"]);
    const r = await abiertasRiesgo(m.hijo2);
    ok("con deuda y faltas seguidas se abre el riesgo (nivel 1, sin evaluación ni curso)", `${r.length} ${r[0]?.nivel} ${r[0]?.evaluacionId} ${r[0]?.cursoId}`, "1 1 null null");
    ok("las alertas de deuda y de faltas siguen abiertas (el riesgo se suma)", `${(await alertasDe("deuda_cuotas", { alumnoId: m.hijo2, resueltaEn: null })).length} ${(await alertasDe("inasistencias_seguidas", { alumnoId: m.hijo2, resueltaEn: null })).length}`, "1 1");
    await revisar(["alumno_en_riesgo"]);
    ok("revisar de nuevo no duplica el riesgo", (await alertasDe("alumno_en_riesgo", { alumnoId: m.hijo2 })).length, 1);
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo2 }, data: { estado: "pagada" } });
    await uow.runInTransaction((tx) => servicio.evaluar(["deuda_cuotas"], tx));
    ok("al saldar la deuda, el anuncio de la alerta cierra el riesgo solo (resuelta)", `${(await abiertasRiesgo(m.hijo2)).length} ${(await alertasDe("alumno_en_riesgo", { alumnoId: m.hijo2 }))[0].motivoCierre}`, "0 resuelta");
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo2 }, data: { estado: "vencida" } });
    await revisar(["deuda_cuotas", "alumno_en_riesgo"]);
    ok("al volver la deuda se abre otra fila de riesgo", (await alertasDe("alumno_en_riesgo", { alumnoId: m.hijo2 })).length, 2);
    await config("deuda_cuotas", { activa: false });
    await revisar(["deuda_cuotas"], "regla-apagada");
    ok("apagar la regla de deuda cierra también el riesgo", (await abiertasRiesgo(m.hijo2)).length, 0);
    await config("deuda_cuotas", { activa: true });

    // ── El servicio ───────────────────────────────────────────────────────────
    let rechazo = "no rechazó";
    try {
      await servicio.actualizar("alumno_en_riesgo", { umbral: 2 });
    } catch (e) {
      rechazo = e instanceof ValidationError ? "ValidationError" : String(e);
    }
    ok("el riesgo no admite número: 400", rechazo, "ValidationError");
    const lista = await servicio.listar();
    ok("el listado informa cuáles reglas tienen número", lista.map((x) => `${x.id}:${x.conNumero}`).join(","), "deuda_cuotas:true,inasistencias_seguidas:true,evaluacion_sin_notas:true,alumno_en_riesgo:false");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    // La prueba revisa la base entera: lo abierto desde el inicio se borra, lo cerrado se reabre y se revisa de nuevo.
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await config("deuda_cuotas", { activa: true, umbral: 2 });
    await config("inasistencias_seguidas", { activa: true, umbral: 3 });
    await config("evaluacion_sin_notas", { activa: true, umbral: 7 });
    await config("alumno_en_riesgo", { activa: true, umbral: 1 });
    await uow.runInTransaction((tx) => servicio.evaluar(REGLA_IDS, tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
