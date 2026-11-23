// El calendario del ciclo manda sobre la asistencia (el servidor rechaza días sin clases), el aviso de asistencia pendiente y el
// aviso de ciclo por cerrar. Toca el ciclo activo real de forma temporal (pausas y fechas) y lo deja como estaba.
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { crearVerificadorDeCiclo } from "../src/modules/ciclos/ciclo.guarda";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const criterios = new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma));
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
async function falla(f: () => Promise<unknown>): Promise<string> {
  try {
    await f();
    return "no falló";
  } catch (e) {
    return (e as Error).message;
  }
}

(async () => {
  const m = await crearMundo(prisma);
  const activo = await prisma.ciclo.findUniqueOrThrow({ where: { id: m.cicloId } });
  const PAUSA = `${P}-pausa-cal`;
  const guardar = (fecha: string) =>
    container.asistenciaService.registrarAsistenciaMasiva(registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha, registros: [{ alumnoId: m.hijo1, estado: "presente" }] }), m.profesorId);
  try {
    // Guardar asistencia
    ok("asistencia fuera del ciclo se rechaza", await falla(() => guardar("2026-01-20")), "Ese día no hay clases: Fuera del ciclo lectivo");
    ok("asistencia en un día con clases se guarda", await falla(() => guardar("2026-03-20")), "no falló");
    await prisma.pausaDelCiclo.create({ data: { id: PAUSA, cicloId: m.cicloId, desde: dia("2026-03-24"), hasta: dia("2026-03-24"), nombre: "Pausa de prueba", tipo: "feriado" } });
    ok("asistencia en una pausa se rechaza con su nombre", await falla(() => guardar("2026-03-24")), "Ese día no hay clases: Pausa de prueba");
    ok("lo ya guardado antes no se toca", await prisma.asistencia.count({ where: { cursoId: m.cursoId, alumnoId: m.hijo1, fecha: dia("2026-03-20") } }), 1);

    // El calendario es el del ciclo del curso, no el del activo
    const viejo = `${P}-ciclo-cal-viejo`;
    await prisma.ciclo.create({ data: { id: viejo, anio: 2097, activo: false, inicio: dia("2020-03-01"), fin: dia("2020-11-30") } });
    await prisma.curso.create({ data: { id: `${P}-curso-cal-viejo`, nombre: "Pruebaav Viejo", nivel: "kids", profesorId: m.profesorId, cicloId: viejo, cupo: 10, estado: "activo" } });
    const verificador = crearVerificadorDeCiclo(new PrismaCicloRepository(prisma), new PrismaCursoRepository(prisma));
    ok("un curso de otro ciclo usa el calendario de su ciclo (día con clases allá)", await falla(() => verificador.verificarDiaDeClases(`${P}-curso-cal-viejo`, "2020-04-14")), "no falló");
    ok("y rechaza un día que en el activo sí tendría clases", await falla(() => verificador.verificarDiaDeClases(`${P}-curso-cal-viejo`, "2026-04-14")), "Ese día no hay clases: Fuera del ciclo lectivo");

    // Aviso de asistencia pendiente (clases martes y jueves 14:00; jueves 15/10/2026)
    const JUEVES_15 = new Date("2026-10-15T18:00:00Z");
    const pendientes = async () => (await criterios.esperados("asistencia_pendiente", JUEVES_15)).filter((a) => a.usuarioId === m.profe).map((a) => a.clave);
    ok("sin pausa: figura la asistencia del jueves", (await pendientes()).includes(`asistencia:${m.cursoId}:2026-10-15`), true);
    await prisma.pausaDelCiclo.create({ data: { id: `${PAUSA}-2`, cicloId: m.cicloId, desde: dia("2026-10-15"), hasta: dia("2026-10-15"), nombre: "Feriado de prueba", tipo: "feriado" } });
    ok("con una pausa ese día: no figura", (await pendientes()).includes(`asistencia:${m.cursoId}:2026-10-15`), false);

    // Aviso de ciclo por cerrar: desde el día siguiente al fin del ciclo activo
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { inicio: dia("2026-03-16"), fin: dia("2026-11-27") } });
    const admin = async (iso: string) => (await criterios.esperados("ciclo_por_cerrar", new Date(iso))).filter((a) => a.usuarioId === m.admin).length;
    ok("el último día del ciclo: sin aviso", await admin("2026-11-27T15:00:00Z"), 0);
    ok("a las 23:00 del último día en Argentina: sin aviso", await admin("2026-11-28T02:00:00Z"), 0);
    ok("el día siguiente al fin: hay aviso", await admin("2026-11-28T03:00:00Z"), 1);
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { fin: dia("2026-12-15") } });
    ok("con el fin más adelante: todavía sin aviso", await admin("2026-12-05T15:00:00Z"), 0);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.pausaDelCiclo.deleteMany({ where: { id: { startsWith: PAUSA } } });
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { inicio: activo.inicio, fin: activo.fin } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
