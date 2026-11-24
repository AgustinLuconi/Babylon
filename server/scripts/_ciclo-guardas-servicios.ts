// Bloqueo de ciclo en asistencia, calificaciones, observaciones y cuotas (regla B: cobrar sigue permitido).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { hoyISOEnArgentina } from "../src/core/fechas";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { cargarCalificacionesSchema, cargarNotasCierreSchema, crearEvaluacionSchema } from "../src/modules/calificaciones/calificacion.schema";
import { ID_CONFIGURACION } from "../src/modules/configuraciones/configuracion.entity";
import { crearCategoriaPersonalizadaSchema } from "../src/modules/observaciones/observacion.schema";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const { cicloService, asistenciaService, calificacionService, observacionService } = container;
const cuotaService = container.cuotaService;

const resultado = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
    return "ok";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};

(async () => {
  const m = await crearMundo(prisma);
  const valorOriginal = (await prisma.configuracion.findUnique({ where: { id: ID_CONFIGURACION } }))?.valorCuota ?? null;
  try {
    const ciclo = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: ciclo, anio: 2099, activo: false, inicio: new Date("2000-01-01T00:00:00Z"), fin: new Date("2099-12-31T00:00:00Z") } }); // calendario ancho: "hoy" cae dentro
    const curso = `${P}-curso-2099`;
    await prisma.curso.create({ data: { id: curso, nombre: "Pruebaav 2099", nivel: "kids", profesorId: m.profesorId, cicloId: ciclo, cupo: 10, estado: "activo" } });
    const alumno = `${P}-alu-2099`;
    await prisma.alumno.create({
      data: { id: alumno, nombre: "Pruebaav2099", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, cursoId: curso, aplicaDescuentoHermanos: false },
    });
    await prisma.inscripcion.create({ data: { id: `${alumno}-insc`, alumnoId: alumno, cursoId: curso, cicloId: ciclo, fecha: new Date(), aplicaDescuentoHermanos: false } });

    const asistencia = registrarAsistenciaMasivaSchema.parse({ cursoId: curso, fecha: hoyISOEnArgentina(), registros: [{ alumnoId: alumno, estado: "presente" }] });
    const evaluacion = crearEvaluacionSchema.parse({ cursoId: curso, nombre: "Pruebaav eval", tipo: "examen", fecha: hoyISOEnArgentina(), periodo: "julio" });
    const categoria = crearCategoriaPersonalizadaSchema.parse({ cursoId: curso, nombre: "Pruebaav categoría" });
    const cierre = cargarNotasCierreSchema.parse({ notas: [{ alumnoId: alumno, cursoId: curso, periodo: "julio", nota: "7" }] }).notas;

    // Con el ciclo abierto todo funciona (y deja lo necesario para las pruebas con el ciclo cerrado)
    ok("abierto: asistencia", await resultado(() => asistenciaService.registrarAsistenciaMasiva(asistencia, m.profesorId)), "ok");
    const evaluacionCreada = await calificacionService.crearEvaluacion(evaluacion, m.profesorId);
    const notas = cargarCalificacionesSchema.parse({ notas: [{ alumnoId: alumno, nota: "8" }] });
    const notaCierre = (await calificacionService.cargarNotasCierre(cierre, m.profesorId))[0];
    ok("abierto: categoría", await resultado(() => observacionService.crearCategoriaPersonalizada(categoria, m.profesorId)), "ok");

    await cicloService.bloquearCiclo(ciclo);
    ok("bloqueado: asistencia", await resultado(() => asistenciaService.registrarAsistenciaMasiva(asistencia, m.profesorId)), "ConflictError");
    ok("bloqueado: crear evaluación", await resultado(() => calificacionService.crearEvaluacion(evaluacion, m.profesorId)), "ConflictError");
    ok("bloqueado: publicar evaluación", await resultado(() => calificacionService.publicarEvaluacion(evaluacionCreada.id, m.profesorId)), "ConflictError");
    ok("bloqueado: cargar calificaciones", await resultado(() => calificacionService.cargarCalificaciones(evaluacionCreada.id, notas, m.profesorId)), "ConflictError");
    ok("bloqueado: cargar notas de cierre", await resultado(() => calificacionService.cargarNotasCierre(cierre, m.profesorId)), "ConflictError");
    ok("bloqueado: publicar notas de cierre", await resultado(() => calificacionService.publicarNotasCierre([notaCierre.id], m.profesorId)), "ConflictError");
    ok("bloqueado: categoría personalizada", await resultado(() => observacionService.crearCategoriaPersonalizada(categoria, m.profesorId)), "ConflictError");
    ok("bloqueado: la evaluación sigue en borrador", (await prisma.evaluacion.findUniqueOrThrow({ where: { id: evaluacionCreada.id } })).estado, "borrador");

    // Regla B: cobrar una cuota pendiente o vencida sigue permitido con el ciclo bloqueado
    const vence = new Date("2099-03-10T00:00:00Z");
    const cuota = (id: string, mes: number, estado: "pendiente" | "vencida") =>
      prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId: alumno, mes, anio: 2099, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: vence, estado } });
    await cuota("cuota-pend", 3, "pendiente");
    await cuota("cuota-venc", 4, "vencida");
    ok("bloqueado: cobrar pendiente y vencida", await resultado(() => cuotaService.registrarPago({ cuotaIds: [`${P}-cuota-pend`, `${P}-cuota-venc`], metodo: "efectivo", registradoPor: m.admin })), "ok");
    ok("las cuotas quedaron pagadas", await prisma.cuota.count({ where: { id: { startsWith: `${P}-cuota-` }, estado: "pagada" } }), 2);

    await cicloService.desbloquearCiclo(ciclo);
    ok("desbloqueado: asistencia", await resultado(() => asistenciaService.registrarAsistenciaMasiva(asistencia, m.profesorId)), "ok");
    ok("desbloqueado: publicar evaluación", await resultado(() => calificacionService.publicarEvaluacion(evaluacionCreada.id, m.profesorId)), "ok");
    ok("desbloqueado: cargar calificaciones", await resultado(() => calificacionService.cargarCalificaciones(evaluacionCreada.id, notas, m.profesorId)), "ok");
    ok("desbloqueado: publicar notas de cierre", await resultado(() => calificacionService.publicarNotasCierre([notaCierre.id], m.profesorId)), "ok");

    // La generación automática no crea cuotas si el ciclo activo estuviera bloqueado (se fuerza solo en esta prueba)
    await prisma.configuracion.upsert({ where: { id: ID_CONFIGURACION }, update: { valorCuota: 1000 }, create: { id: ID_CONFIGURACION, valorCuota: 1000 } });
    const activo = await prisma.ciclo.findFirstOrThrow({ where: { activo: true } });
    const hoy = new Date(`${activo.anio}-05-12T15:00:00Z`);
    const hijo = await prisma.alumno.findUniqueOrThrow({ where: { id: m.hijo1 } });
    const entidad = { ...hijo, dni: hijo.dni ?? undefined } as never;
    await prisma.ciclo.update({ where: { id: activo.id }, data: { bloqueado: true } });
    const conBloqueo = await cuotaService.generarCuotaInicial(entidad, hoy);
    await prisma.ciclo.update({ where: { id: activo.id }, data: { bloqueado: false } });
    ok("ciclo activo bloqueado (forzado): no genera cuota inicial", conBloqueo, null);
    const sinBloqueo = await cuotaService.generarCuotaInicial(entidad, hoy);
    ok("ciclo activo abierto: genera cuota inicial", sinBloqueo !== null, true);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { bloqueado: false } });
    await prisma.configuracion.update({ where: { id: ID_CONFIGURACION }, data: { valorCuota: valorOriginal } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
