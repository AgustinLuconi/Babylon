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
  const inicioDePrueba = new Date();
  const m = await crearMundo(prisma);
  const activo = await prisma.ciclo.findUniqueOrThrow({ where: { id: m.cicloId } });
  const PAUSA = `${P}-pausa-cal`;
  const guardar = (fecha: string, registros: { alumnoId: string; estado: "presente" | "ausente"; justificada?: boolean; motivo?: string }[] = [{ alumnoId: m.hijo1, estado: "presente" }]) =>
    container.asistenciaService.registrarAsistenciaMasiva(registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha, registros }), m.profesorId);
  try {
    // Guardar asistencia
    ok("asistencia fuera del ciclo se rechaza", await falla(() => guardar("2026-01-20")), "Ese día no hay clases: Fuera del ciclo lectivo");
    ok("asistencia en un día con clases se guarda", await falla(() => guardar("2026-03-20")), "no falló");
    await prisma.pausaDelCiclo.create({ data: { id: PAUSA, cicloId: m.cicloId, desde: dia("2026-03-24"), hasta: dia("2026-03-24"), nombre: "Pausa de prueba", tipo: "feriado" } });
    ok("asistencia en una pausa se rechaza con su nombre", await falla(() => guardar("2026-03-24")), "Ese día no hay clases: Pausa de prueba");
    // Lo ya guardado se puede seguir corrigiendo aunque ese día pase a no tener clases; lo nuevo, no
    await prisma.pausaDelCiclo.create({ data: { id: `${PAUSA}-3`, cicloId: m.cicloId, desde: dia("2026-03-20"), hasta: dia("2026-03-20"), nombre: "Feriado agregado después", tipo: "feriado" } });
    ok("un día que pasó a no tener clases: se puede corregir/justificar lo ya guardado", await falla(() => guardar("2026-03-20", [{ alumnoId: m.hijo1, estado: "ausente", justificada: true, motivo: "Certificado" }])), "no falló");
    ok("y la corrección quedó guardada", (await prisma.asistencia.findFirst({ where: { cursoId: m.cursoId, alumnoId: m.hijo1, fecha: dia("2026-03-20") } }))?.justificada, true);
    ok("pero crear un registro nuevo en ese día se rechaza", await falla(() => guardar("2026-03-20", [{ alumnoId: m.hijo1, estado: "presente" }, { alumnoId: m.hijo2, estado: "presente" }])), "Ese día no hay clases: Feriado agregado después");
    ok("y no queda nada a medias (todo o nada)", await prisma.asistencia.count({ where: { cursoId: m.cursoId, alumnoId: m.hijo2, fecha: dia("2026-03-20") } }), 0);
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

    // Editar el calendario por el servicio real recalcula los avisos en el momento (sin esperar a la revisión de la madrugada)
    const avisoPorCerrar = () => prisma.notificacion.count({ where: { usuarioId: m.admin, rol: "admin", tipo: "ciclo_por_cerrar", resueltaEn: null } });
    await container.cicloService.editarFechas(m.cicloId, { inicio: "2026-03-16", fin: "2026-11-20" });
    ok("el fin ya pasó: editar las fechas crea el aviso de ciclo por cerrar", await avisoPorCerrar(), 1);
    await container.cicloService.editarFechas(m.cicloId, { inicio: "2026-03-16", fin: "2026-12-31" });
    ok("se extiende el fin: el aviso deja de estar abierto", await avisoPorCerrar(), 0);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.pausaDelCiclo.deleteMany({ where: { id: { startsWith: PAUSA } } });
    // Editar el calendario por el servicio real crea y resuelve avisos de ciclo por cerrar también en las cuentas reales de administración.
    await prisma.notificacion.deleteMany({ where: { tipo: "ciclo_por_cerrar", creadaEn: { gte: inicioDePrueba } } });
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { inicio: activo.inicio, fin: activo.fin } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
