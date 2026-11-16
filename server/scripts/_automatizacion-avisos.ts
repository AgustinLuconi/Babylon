// Los avisos de la campana que salen de las alertas: a quién le llegan, qué dicen, que no se duplican ni se pisan, que siguen
// al profesor del curso y las preferencias de cada rol.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import type { ReglaId } from "../src/modules/automatizaciones/automatizacion.reconciliar";
import { textoDeAlertaDeDeuda, textoDeAlertaDeFaltas } from "../src/modules/notificaciones/notificacion.alertas";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const corto = (id: string) => id.replace(`${P}-`, "");
const TIPOS = ["alumno_con_deuda", "alumno_con_faltas", "alumno_con_faltas_profesor"] as const;
const revisar = (reglas: ReglaId[]) => uow.runInTransaction((tx) => container.automatizacionService.evaluar(reglas, tx));
const sincronizar = (tipos: (typeof TIPOS)[number][]) => uow.runInTransaction((tx) => container.notificacionService.sincronizar(tipos, tx));
const avisos = (tipo: (typeof TIPOS)[number], usuarioId: string, rol: string) =>
  prisma.notificacion.findMany({ where: { tipo, usuarioId, rol: rol as never, clave: { contains: `${P}-` } } });
const abiertos = async (tipo: (typeof TIPOS)[number], usuarioId: string, rol: string) => (await avisos(tipo, usuarioId, rol)).filter((a) => a.resueltaEn === null);

(async () => {
  const m = await crearMundo(prisma);
  const inicio = new Date();
  try {
    await prisma.automatizacion.upsert({ where: { regla: "deuda_cuotas" }, update: { activa: true, umbral: 2 }, create: { regla: "deuda_cuotas", activa: true, umbral: 2 } });
    await prisma.automatizacion.upsert({ where: { regla: "inasistencias_seguidas" }, update: { activa: true, umbral: 3 }, create: { regla: "inasistencias_seguidas", activa: true, umbral: 3 } });
    let q = 0;
    const cuota = () => prisma.cuota.create({ data: { id: `${P}-q${++q}`, alumnoId: m.hijo2, mes: q, anio: 2080, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado: "vencida" } });
    await cuota();
    await cuota();
    let n = 0;
    for (const d of [1, 2, 3]) await prisma.asistencia.create({ data: { id: `${P}-as${++n}`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: new Date(Date.UTC(2020, 0, d)), estado: "ausente" } });
    await revisar(["deuda_cuotas", "inasistencias_seguidas"]);

    const nombreHijo2 = "Lunaav Pruebaav";
    const nombreHijo1 = "Tomasav Pruebaav";
    // Deuda: administración y secretaría
    for (const [quien, cuenta, rol] of [["admin", m.admin, "admin"], ["secretaría", m.secre, "secretario"]] as const) {
      const a = await abiertos("alumno_con_deuda", cuenta, rol);
      ok(`deuda: ${quien} recibe un aviso`, a.length, 1);
      ok(`deuda: ${quien} — texto, tono, nivel y recurso`, `${a[0]?.texto}|${a[0]?.tono}|${a[0]?.nivel}|${JSON.stringify(a[0]?.recurso)}`, `${textoDeAlertaDeDeuda(nombreHijo2, 2)}|danger|2|${JSON.stringify({ tipo: "alumno", alumnoId: m.hijo2 })}`);
      ok(`deuda: ${quien} — es un aviso de estado con la clave de la alerta`, `${a[0]?.clase} ${a[0]?.clave}`, `estado alerta:deuda_cuotas:${m.hijo2}`);
    }
    ok("deuda: ni el profesor, ni la familia reciben nada", (await avisos("alumno_con_deuda", m.profe, "profesor")).length + (await avisos("alumno_con_deuda", m.padre, "padre")).length + (await avisos("alumno_con_deuda", m.ajeno, "padre")).length, 0);

    // Faltas: administración, secretaría y el profesor del curso (no otro profesor)
    for (const [quien, cuenta, rol] of [["admin", m.admin, "admin"], ["secretaría", m.secre, "secretario"], ["multi como admin", m.multi, "admin"]] as const) {
      const a = await abiertos("alumno_con_faltas", cuenta, rol);
      ok(`faltas: ${quien} recibe un aviso con curso y nivel`, `${a.length} ${a[0]?.texto} ${a[0]?.nivel}`, `1 ${textoDeAlertaDeFaltas(nombreHijo1, 3, "Pruebaav Kids")} 3`);
    }
    const delProfe = await abiertos("alumno_con_faltas_profesor", m.profe, "profesor");
    const recurso = delProfe[0]?.recurso as { tipo?: string; cursoId?: string; fecha?: string } | undefined; // jsonb reordena las claves
    ok("faltas: el profesor del curso recibe su aviso con un enlace a la asistencia de la última falta", `${delProfe.length} ${recurso?.tipo} ${recurso?.cursoId === m.cursoId} ${recurso?.fecha}`, "1 asistencia true 2020-01-03");
    ok("faltas: otro profesor (la cuenta con dos roles) no recibe el del curso ajeno", (await avisos("alumno_con_faltas_profesor", m.multi, "profesor")).length, 0);
    ok("faltas: la administración no recibe el aviso del profesor ni al revés", (await avisos("alumno_con_faltas_profesor", m.admin, "admin")).length + (await avisos("alumno_con_faltas", m.profe, "profesor")).length, 0);

    // Sincronizar dos veces no duplica ni pisa lo leído; si el nivel sube, vuelve a "no leído" (Foco 1)
    const deAdmin = (await abiertos("alumno_con_deuda", m.admin, "admin"))[0];
    await prisma.notificacion.update({ where: { id: deAdmin.id }, data: { leidaEn: new Date() } });
    await sincronizar(["alumno_con_deuda"]);
    await sincronizar(["alumno_con_deuda"]);
    const igual = await avisos("alumno_con_deuda", m.admin, "admin");
    ok("sincronizar de nuevo no duplica y conserva lo leído", `${igual.length} ${igual[0].id === deAdmin.id} ${igual[0].leidaEn !== null}`, "1 true true");
    await cuota();
    await revisar(["deuda_cuotas"]);
    const subio = (await avisos("alumno_con_deuda", m.admin, "admin"))[0];
    ok("al subir el nivel el aviso vuelve a no leído, con el texto nuevo", `${subio.leidaEn} ${subio.nivel} ${subio.texto}`, `null 3 ${textoDeAlertaDeDeuda(nombreHijo2, 3)}`);

    // Resolver: el aviso se cierra
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo2 }, data: { estado: "pagada" } });
    await revisar(["deuda_cuotas"]);
    ok("al pagar, los avisos de deuda quedan resueltos", (await abiertos("alumno_con_deuda", m.admin, "admin")).length + (await abiertos("alumno_con_deuda", m.secre, "secretario")).length, 0);

    // Reasignar el profesor del curso con la alerta abierta (Foco 5)
    await container.cursoService.actualizarCurso(m.cursoId, { profesorId: m.profesorMultiId });
    ok("reasignar el curso: el profesor anterior deja de tener el aviso", (await abiertos("alumno_con_faltas_profesor", m.profe, "profesor")).length, 0);
    ok("reasignar el curso: el profesor nuevo lo recibe", (await abiertos("alumno_con_faltas_profesor", m.multi, "profesor")).length, 1);

    // Preferencias
    const prefs = async (cuenta: string, rol: string) => (await container.notificacionService.preferencias({ usuarioId: cuenta, rol: rol as never })).map((p) => p.tipo);
    ok("preferencias: administración lista los dos tipos de staff", (await prefs(m.admin, "admin")).filter((t) => t.startsWith("alumno_con_")).sort().join(","), "alumno_con_deuda,alumno_con_faltas");
    ok("preferencias: secretaría los mismos dos", (await prefs(m.secre, "secretario")).filter((t) => t.startsWith("alumno_con_")).sort().join(","), "alumno_con_deuda,alumno_con_faltas");
    ok("preferencias: el profesor, el suyo", (await prefs(m.multi, "profesor")).filter((t) => t.startsWith("alumno_con_")).join(","), "alumno_con_faltas_profesor");
    ok("preferencias: la familia, ninguno", (await prefs(m.padre, "padre")).filter((t) => t.startsWith("alumno_con_")).length, 0);
    await container.notificacionService.cambiarPreferencia({ usuarioId: m.admin, rol: "admin" }, "alumno_con_faltas", false);
    ok("apagar el tipo para administración borra su aviso y deja el de secretaría", `${(await avisos("alumno_con_faltas", m.admin, "admin")).length} ${(await abiertos("alumno_con_faltas", m.secre, "secretario")).length}`, "0 1");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    ok("limpieza: no quedan avisos de alertas sobre alumnos de prueba (tampoco en cuentas reales)", await prisma.notificacion.count({ where: { tipo: { in: [...TIPOS] }, clave: { contains: `${P}-` } } }), 0);
    // Se deshace lo que la prueba abrió o cerró sobre alumnos reales y se vuelve a revisar.
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await uow.runInTransaction((tx) => container.automatizacionService.evaluar(["deuda_cuotas", "inasistencias_seguidas"], tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
