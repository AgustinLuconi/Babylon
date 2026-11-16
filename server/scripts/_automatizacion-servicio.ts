// El servicio de automatizaciones: abre, actualiza y cierra alertas; no duplica; apagar/encender; cambio de número; baja y
// cambio de ciclo; revisiones simultáneas; y que los anuncios reales (pago, asistencia) revisan la regla.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import type { ReglaId } from "../src/modules/automatizaciones/automatizacion.reconciliar";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const servicio = container.automatizacionService;
const revisar = (reglas: ReglaId[], causa?: "revision" | "regla-apagada" | "cambio-de-numero") => uow.runInTransaction((tx) => servicio.evaluar(reglas, tx, causa));
const config = (regla: ReglaId, datos: { activa?: boolean; umbral?: number }) =>
  prisma.automatizacion.upsert({ where: { regla }, update: datos, create: { regla, activa: true, umbral: regla === "deuda_cuotas" ? 2 : 3, ...datos } });
const alertas = (regla: ReglaId, alumnoId: string) => prisma.alertaAutomatica.findMany({ where: { regla, alumnoId }, orderBy: { abiertaEn: "asc" } });
const abiertas = async (regla: ReglaId, alumnoId: string) => (await alertas(regla, alumnoId)).filter((a) => a.resueltaEn === null);

(async () => {
  const inicio = new Date();
  const m = await crearMundo(prisma);
  const activoOriginal = m.cicloId;
  try {
    await config("deuda_cuotas", { activa: true, umbral: 2 });
    await config("inasistencias_seguidas", { activa: true, umbral: 3 });
    let mes = 0;
    const cuota = (alumnoId: string, estado: "pendiente" | "pagada" | "vencida") =>
      prisma.cuota.create({ data: { id: `${P}-q${++mes}`, alumnoId, mes: ((mes - 1) % 12) + 1, anio: 2080 + Math.floor((mes - 1) / 12), montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2080-03-10T00:00:00Z"), estado } });
    await cuota(m.hijo2, "vencida");
    await cuota(m.hijo2, "vencida");
    let n = 0;
    const falta = (alumnoId: string, dia: number, estado: "presente" | "ausente" = "ausente") =>
      prisma.asistencia.create({ data: { id: `${P}-as${++n}`, alumnoId, cursoId: m.cursoId, fecha: new Date(Date.UTC(2020, 0, dia)), estado } });
    for (const d of [1, 2, 3]) await falta(m.hijo1, d);

    // Abrir
    await revisar(["deuda_cuotas", "inasistencias_seguidas"]);
    const deuda = await abiertas("deuda_cuotas", m.hijo2);
    const faltas = await abiertas("inasistencias_seguidas", m.hijo1);
    ok("deuda: se abre una alerta con nivel 2 y sin curso", `${deuda.length} ${deuda[0]?.nivel} ${deuda[0]?.cursoId}`, "1 2 null");
    ok("inasistencias: se abre una alerta con nivel 3 y su curso", `${faltas.length} ${faltas[0]?.nivel} ${faltas[0]?.cursoId === m.cursoId}`, "1 3 true");
    ok("la alerta guarda cuándo se abrió y sigue sin resolver", `${!!deuda[0]?.abiertaEn} ${deuda[0]?.resueltaEn}`, "true null");
    ok("la regla guarda la última revisión", !!(await prisma.automatizacion.findUniqueOrThrow({ where: { regla: "deuda_cuotas" } })).ultimaRevisionEn, true);

    // Revisar dos veces no duplica (Foco 1)
    await revisar(["deuda_cuotas", "inasistencias_seguidas"]);
    ok("revisar de nuevo no duplica la alerta", `${(await alertas("deuda_cuotas", m.hijo2)).length} ${(await abiertas("deuda_cuotas", m.hijo2))[0]?.id === deuda[0].id}`, "1 true");

    // Sube el nivel: la misma fila
    await cuota(m.hijo2, "vencida");
    await revisar(["deuda_cuotas"]);
    const subio = await abiertas("deuda_cuotas", m.hijo2);
    ok("con una cuota más sube el nivel de la misma fila", `${subio.length} ${subio[0]?.nivel} ${subio[0]?.id === deuda[0].id}`, "1 3 true");

    // Resolver
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo2 }, data: { estado: "pagada" } });
    await revisar(["deuda_cuotas"]);
    const resuelta = (await alertas("deuda_cuotas", m.hijo2))[0];
    ok("al pagar se cierra con motivo resuelta", `${resuelta.motivoCierre} ${!!resuelta.resueltaEn}`, "resuelta true");

    // Apagar y volver a prender: filas nuevas (Foco 3)
    await prisma.cuota.updateMany({ where: { alumnoId: m.hijo2 }, data: { estado: "vencida" } });
    await revisar(["deuda_cuotas"]);
    ok("vuelve a deber: se abre otra fila (el historial no se mezcla)", `${(await alertas("deuda_cuotas", m.hijo2)).length} ${(await abiertas("deuda_cuotas", m.hijo2)).length}`, "2 1");
    await config("deuda_cuotas", { activa: false });
    await revisar(["deuda_cuotas"], "regla-apagada");
    const apagada = await alertas("deuda_cuotas", m.hijo2);
    ok("apagar la regla cierra sus alertas con regla-apagada", `${(await abiertas("deuda_cuotas", m.hijo2)).length} ${apagada[apagada.length - 1].motivoCierre}`, "0 regla-apagada");
    await config("deuda_cuotas", { activa: true });
    await revisar(["deuda_cuotas"]);
    ok("al prenderla de nuevo se abre una fila nueva (3 en total)", `${(await alertas("deuda_cuotas", m.hijo2)).length} ${(await abiertas("deuda_cuotas", m.hijo2)).length}`, "3 1");

    // Cambio de número
    await config("deuda_cuotas", { umbral: 4 });
    await revisar(["deuda_cuotas"], "cambio-de-numero");
    const porNumero = await alertas("deuda_cuotas", m.hijo2);
    ok("subir el número a 4 cierra con cambio-de-numero", `${(await abiertas("deuda_cuotas", m.hijo2)).length} ${porNumero[porNumero.length - 1].motivoCierre}`, "0 cambio-de-numero");
    await config("deuda_cuotas", { umbral: 2 });

    // Revisiones simultáneas (Foco 6): una sola alerta abierta
    await Promise.all([revisar(["deuda_cuotas"]), revisar(["deuda_cuotas"])]);
    ok("dos revisiones en paralelo dejan una sola alerta abierta", (await abiertas("deuda_cuotas", m.hijo2)).length, 1);

    // Baja del alumno: ya-no-corresponde
    await prisma.alumno.update({ where: { id: m.hijo1 }, data: { estado: "inactivo" } });
    await revisar(["inasistencias_seguidas"]);
    const porBaja = await alertas("inasistencias_seguidas", m.hijo1);
    ok("al darse de baja se cierra con ya-no-corresponde", `${(await abiertas("inasistencias_seguidas", m.hijo1)).length} ${porBaja[porBaja.length - 1].motivoCierre}`, "0 ya-no-corresponde");
    await prisma.alumno.update({ where: { id: m.hijo1 }, data: { estado: "activo" } });

    // Anuncios reales: la asistencia y el pago revisan la regla solos
    await container.asistenciaService.registrarAsistenciaMasiva(
      registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha: "2026-01-20", registros: [{ alumnoId: m.hijo1, estado: "presente" }] }),
      m.profesorId,
    );
    ok("guardar asistencia dispara la revisión (presente corta la racha: se cierra o no se abre)", (await abiertas("inasistencias_seguidas", m.hijo1)).length, 0);
    await falta(m.hijo2, 21);
    for (const d of [22, 23]) await falta(m.hijo2, d);
    await container.asistenciaService.registrarAsistenciaMasiva(
      registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha: "2026-01-24", registros: [{ alumnoId: m.hijo2, estado: "ausente" }] }),
      m.profesorId,
    );
    ok("guardar una ausencia que completa la racha abre la alerta sin llamar al servicio", (await abiertas("inasistencias_seguidas", m.hijo2)).length, 1);
    const cuotasVencidas = await prisma.cuota.findMany({ where: { alumnoId: m.hijo2, estado: "vencida" }, select: { id: true } });
    await container.cuotaService.registrarPago({ cuotaIds: cuotasVencidas.map((c) => c.id), metodo: "efectivo", registradoPor: m.admin });
    ok("cobrar las cuotas dispara la revisión y cierra la alerta de deuda", (await abiertas("deuda_cuotas", m.hijo2)).length, 0);

    // Activar otro ciclo (pase de año): las alertas que quedan fuera se cierran con ya-no-corresponde (Foco 4)
    const otro = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: otro, anio: 2099, activo: false } });
    await container.cicloService.marcarActivo(otro);
    const alCambiarDeCiclo = await alertas("inasistencias_seguidas", m.hijo2);
    ok("activar otro ciclo cierra con ya-no-corresponde las alertas que quedan fuera", `${(await abiertas("inasistencias_seguidas", m.hijo2)).length} ${alCambiarDeCiclo[alCambiarDeCiclo.length - 1].motivoCierre}`, "0 ya-no-corresponde");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: activoOriginal }, data: { activo: true } });
    await limpiarMundo(prisma);
    // La prueba revisa la base entera: lo que abrió o cerró sobre alumnos reales se deshace (se borra lo abierto desde el inicio y
    // se reabre lo que cerró) y se revisa de nuevo para que el estado quede como lo calculan las reglas.
    await prisma.alertaAutomatica.deleteMany({ where: { abiertaEn: { gte: inicio } } });
    await prisma.alertaAutomatica.updateMany({ where: { resueltaEn: { gte: inicio } }, data: { resueltaEn: null, motivoCierre: null } });
    await prisma.automatizacion.upsert({ where: { regla: "deuda_cuotas" }, update: { activa: true, umbral: 2 }, create: { regla: "deuda_cuotas", activa: true, umbral: 2 } });
    await prisma.automatizacion.upsert({ where: { regla: "inasistencias_seguidas" }, update: { activa: true, umbral: 3 }, create: { regla: "inasistencias_seguidas", activa: true, umbral: 3 } });
    await uow.runInTransaction((tx) => servicio.evaluar(["deuda_cuotas", "inasistencias_seguidas"], tx));
    await prisma.$disconnect();
    process.exit(0);
  }
})();
