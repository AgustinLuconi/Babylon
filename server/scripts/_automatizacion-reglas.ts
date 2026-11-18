// Los evaluadores de las dos reglas contra la base (mundo de prueba): qué alumnos entran en alerta y con qué nivel.
import { PrismaClient } from "@prisma/client";
import { PrismaEvaluadoresDeReglas } from "../src/modules/automatizaciones/automatizacion.evaluadores.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const evaluadores = new PrismaEvaluadoresDeReglas(prisma);
const corto = (id: string) => id.replace(`${P}-`, "");
// Solo los alumnos de prueba (la base también tiene a los reales).
const resumen = (esperadas: { alumnoId: string; cursoId: string | null; nivel: number }[]) =>
  esperadas.filter((e) => e.alumnoId.startsWith(P)).map((e) => `${corto(e.alumnoId)}${e.cursoId ? "@" + corto(e.cursoId) : ""}:${e.nivel}`).sort().join(",");

(async () => {
  const m = await crearMundo(prisma);
  try {
    // ── Deuda ─────────────────────────────────────────────────────────────
    let mes = 0;
    const cuota = (alumnoId: string, estado: "pendiente" | "pagada" | "vencida") =>
      prisma.cuota.create({ data: { id: `${P}-q${++mes}`, alumnoId, mes: ((mes - 1) % 12) + 1, anio: 2080 + Math.floor((mes - 1) / 12), montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado } });
    await cuota(m.hijo1, "vencida");
    for (const e of ["vencida", "vencida", "pendiente", "pagada"] as const) await cuota(m.hijo2, e);
    for (let i = 0; i < 3; i++) await cuota(m.alumnoAjeno, "vencida");
    const sinInscripcion = `${P}-sininsc`;
    await prisma.alumno.create({ data: { id: sinInscripcion, nombre: "Pruebaavsin", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, aplicaDescuentoHermanos: false } });
    await cuota(sinInscripcion, "vencida");
    await cuota(sinInscripcion, "vencida");

    ok("deuda con 2: entran los de 2 cuotas o más (las pendientes y pagadas no cuentan; sin inscripción no entra)", resumen((await evaluadores.deuda_cuotas.evaluar(2)).esperadas), "alumno-ajeno:3,hijo2:2");
    ok("deuda con 3: solo el de 3", resumen((await evaluadores.deuda_cuotas.evaluar(3)).esperadas), "alumno-ajeno:3");
    ok("deuda con 1: entra también el de 1", resumen((await evaluadores.deuda_cuotas.evaluar(1)).esperadas), "alumno-ajeno:3,hijo1:1,hijo2:2");
    const poblacion = (await evaluadores.deuda_cuotas.evaluar(2)).poblacion;
    ok("deuda: la población incluye a los inscriptos aunque no deban", poblacion.has(`${m.hijo1}||`), true);
    ok("deuda: sin inscripción en el ciclo activo no está en la población", poblacion.has(`${sinInscripcion}||`), false);
    await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "inactivo" } });
    ok("deuda: un alumno inactivo no entra", resumen((await evaluadores.deuda_cuotas.evaluar(2)).esperadas), "alumno-ajeno:3");
    await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "activo" } });

    // ── Inasistencias seguidas ──────────────────────────────────────────────
    let n = 0;
    const falta = (alumnoId: string, cursoId: string, dia: number, estado: "presente" | "tarde" | "ausente", justificada = false) =>
      prisma.asistencia.create({ data: { id: `${P}-as${++n}`, alumnoId, cursoId, fecha: new Date(Date.UTC(2080, 0, dia)), estado, justificada, motivo: justificada ? "Gripe" : null } });
    for (const d of [1, 2, 3, 4]) await falta(m.hijo1, m.cursoId, d, "ausente"); // racha 4
    await falta(m.hijo2, m.cursoId, 1, "ausente");
    await falta(m.hijo2, m.cursoId, 2, "ausente");
    await falta(m.hijo2, m.cursoId, 3, "ausente", true); // la más nueva está justificada: racha 0
    await falta(m.alumnoAjeno, m.cursoMultiId, 1, "presente");
    await falta(m.alumnoAjeno, m.cursoMultiId, 2, "ausente");
    await falta(m.alumnoAjeno, m.cursoMultiId, 3, "ausente"); // racha 2
    for (const d of [10, 11, 12]) await falta(m.hijo1, m.cursoMultiId, d, "ausente"); // otro curso: no es el de su inscripción

    ok("inasistencias con 3: solo la racha de 4 (justificada corta; el otro curso no cuenta)", resumen((await evaluadores.inasistencias_seguidas.evaluar(3)).esperadas), `hijo1@curso:4`);
    ok("inasistencias con 2: entra también la de 2", resumen((await evaluadores.inasistencias_seguidas.evaluar(2)).esperadas), `alumno-ajeno@curso-multi:2,hijo1@curso:4`);
    ok("inasistencias con 5: nadie", resumen((await evaluadores.inasistencias_seguidas.evaluar(5)).esperadas), "");
    const pob = (await evaluadores.inasistencias_seguidas.evaluar(3)).poblacion;
    ok("inasistencias: la población son los pares (alumno, curso de su inscripción)", `${pob.has(`${m.hijo2}|${m.cursoId}|`)} ${pob.has(`${m.hijo1}|${m.cursoMultiId}|`)}`, "true false");
    await falta(m.alumnoAjeno, m.cursoMultiId, 4, "tarde");
    ok("llegar tarde corta la racha", resumen((await evaluadores.inasistencias_seguidas.evaluar(2)).esperadas), `hijo1@curso:4`);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
