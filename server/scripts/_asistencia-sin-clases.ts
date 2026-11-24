// Clase sin dictar (servicio real): marcar y quitar, la regla con la asistencia, el bloqueo del ciclo, los anuncios y la carrera.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { marcarSinClasesSchema, registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { AsistenciaService } from "../src/modules/asistencia/asistencia.service";
import { PrismaAsistenciaRepository } from "../src/modules/asistencia/asistencia.repository.prisma";
import { crearVerificadorDeCiclo } from "../src/modules/ciclos/ciclo.guarda";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const asistenciaRepo = new PrismaAsistenciaRepository(prisma);
const cursoRepo = new PrismaCursoRepository(prisma);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const anuncios: { nombre: string; datos: any }[] = [];
tablero.alPublicarse("asistencia.registrada", async (d) => void anuncios.push({ nombre: "asistencia.registrada", datos: d }));
tablero.alPublicarse("datos.cambiaron", async (d) => void anuncios.push({ nombre: "datos.cambiaron", datos: d }));
const servicio = new AsistenciaService(
  asistenciaRepo,
  cursoRepo,
  new PrismaAlumnoRepository(prisma),
  new PrismaUnitOfWork(prisma),
  tablero,
  crearVerificadorDeCiclo(new PrismaCicloRepository(prisma), cursoRepo),
);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
// "ClaseDelError: mensaje" de lo que lanza, o "no falló".
async function falla(f: () => Promise<unknown>): Promise<string> {
  try {
    await f();
    return "no falló";
  } catch (e) {
    return `${(e as Error).constructor.name}: ${(e as Error).message}`;
  }
}
const SIN_CLASES_Y_ASISTENCIA = "Ese día ya tiene asistencia guardada: no se puede marcar como sin clases";
const MARCADA = "Esa clase está marcada como sin clases: quitá la marca para tomar asistencia";

(async () => {
  const m = await crearMundo(prisma);
  const PAUSA = `${P}-pausa-sc`;
  try {
    const marcas = (fecha: string) => prisma.claseSinDictar.count({ where: { cursoId: m.cursoId, fecha: dia(fecha) } });
    const filas = (fecha: string) => prisma.asistencia.count({ where: { cursoId: m.cursoId, fecha: dia(fecha) } });
    const guardar = (fecha: string, alumnoIds = [m.hijo1, m.hijo2]) =>
      servicio.registrarAsistenciaMasiva(registrarAsistenciaMasivaSchema.parse({ cursoId: m.cursoId, fecha, registros: alumnoIds.map((alumnoId) => ({ alumnoId, estado: "presente" })) }), m.profesorId);
    const marcar = (fecha: string, motivo?: string, profesorId = m.profesorId) => servicio.marcarSinClases({ cursoId: m.cursoId, fecha: dia(fecha), motivo }, profesorId, m.profe);
    const quitar = (fecha: string, profesorId = m.profesorId) => servicio.quitarSinClases({ cursoId: m.cursoId, fecha: dia(fecha) }, profesorId);

    // Marcar y quitar
    const filasAntes = await prisma.asistencia.count({ where: { cursoId: m.cursoId } });
    const marca = await marcar("2026-03-17", "Corte de luz");
    ok("marcar guarda la marca con su motivo y quién la hizo", `${marca.motivo} ${marca.registradaPor === m.profe}`, "Corte de luz true");
    await marcar("2026-03-17", "Paro de transporte");
    ok("marcar de nuevo solo actualiza el motivo (una sola marca)", `${await marcas("2026-03-17")} ${(await asistenciaRepo.findClaseSinDictar(m.cursoId, dia("2026-03-17")))?.motivo}`, "1 Paro de transporte");
    await quitar("2026-03-17");
    ok("quitar la borra", await marcas("2026-03-17"), 0);
    ok("quitar una que no existe no falla", await falla(() => quitar("2026-03-17")), "no falló");
    ok("marcar y quitar no crean ni tocan filas de asistencia", (await prisma.asistencia.count({ where: { cursoId: m.cursoId } })) === filasAntes, true);

    // La regla con la asistencia
    await guardar("2026-03-19");
    ok("con asistencia guardada ese día no se puede marcar", await falla(() => marcar("2026-03-19")), `ConflictError: ${SIN_CLASES_Y_ASISTENCIA}`);
    ok("y no queda ninguna marca", await marcas("2026-03-19"), 0);
    await marcar("2026-03-24", "Docente enfermo");
    ok("con el día marcado no se puede tomar asistencia", await falla(() => guardar("2026-03-24")), `ConflictError: ${MARCADA}`);
    ok("y no se guarda ninguna fila (todo o nada)", await filas("2026-03-24"), 0);
    await quitar("2026-03-24");
    ok("al quitar la marca ya se puede tomar asistencia", `${await falla(() => guardar("2026-03-24"))} ${await filas("2026-03-24")}`, "no falló 2");

    // Quién y cuándo
    ok("otro profesor no puede marcar", (await falla(() => marcar("2026-03-26", undefined, m.profesorMultiId))).split(":")[0], "AuthorizationError");
    await marcar("2026-03-26");
    ok("otro profesor no puede quitar", (await falla(() => quitar("2026-03-26", m.profesorMultiId))).split(":")[0], "AuthorizationError");
    await quitar("2026-03-26");
    await prisma.pausaDelCiclo.create({ data: { id: PAUSA, cicloId: m.cicloId, desde: dia("2026-03-31"), hasta: dia("2026-03-31"), nombre: "Pausa de prueba", tipo: "feriado" } });
    ok("un día sin clases del calendario no se marca", await falla(() => marcar("2026-03-31")), "ValidationError: Ese día no hay clases: Pausa de prueba");
    ok("un día futuro no pasa el esquema", marcarSinClasesSchema.safeParse({ cursoId: m.cursoId, fecha: "2099-01-01" }).success, false);
    ok("un motivo de más de 200 caracteres no pasa el esquema", marcarSinClasesSchema.safeParse({ cursoId: m.cursoId, fecha: "2026-03-17", motivo: "x".repeat(201) }).success, false);

    // Anuncios (y que la marca vale también para quien se inscribe después)
    anuncios.length = 0;
    await marcar("2026-04-07", "Imprevisto");
    const nuevo = `${P}-alu-tarde`;
    await prisma.alumno.create({ data: { id: nuevo, nombre: "Pruebaavtarde", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, cursoId: m.cursoId, aplicaDescuentoHermanos: false } });
    await prisma.inscripcion.create({ data: { id: `${nuevo}-insc`, alumnoId: nuevo, cursoId: m.cursoId, cicloId: m.cicloId, fecha: new Date(), aplicaDescuentoHermanos: false } });
    await marcar("2026-04-07", "Imprevisto (actualizado)");
    const cambios = anuncios.filter((a) => a.nombre === "datos.cambiaron");
    ok("marcar anuncia asistencia/sin-clases con el curso", `${cambios[0]?.datos.dato}/${cambios[0]?.datos.accion} ${JSON.stringify(cambios[0]?.datos.ids.cursoIds)}`, `asistencia/sin-clases ${JSON.stringify([m.cursoId])}`);
    ok("los alumnos anunciados son los inscriptos al curso en ese momento", `${cambios[0]?.datos.ids.alumnoIds.includes(m.hijo1)} ${cambios[0]?.datos.ids.alumnoIds.includes(nuevo)} ${cambios[1]?.datos.ids.alumnoIds.includes(nuevo)}`, "true false true");
    ok("también anuncia asistencia.registrada (para revisar los avisos)", anuncios.some((a) => a.nombre === "asistencia.registrada" && a.datos.cursoId === m.cursoId), true);
    anuncios.length = 0;
    await quitar("2026-04-07");
    ok("quitar anuncia asistencia/quitar-sin-clases", `${anuncios.find((a) => a.nombre === "datos.cambiaron")?.datos.accion}`, "quitar-sin-clases");
    anuncios.length = 0;
    await quitar("2026-04-07");
    ok("quitar una marca que no existe no anuncia nada", anuncios.length, 0);

    // Lecturas: el motivo es solo para el equipo
    await marcar("2026-05-05", "Motivo secreto");
    await servicio.marcarSinClases({ cursoId: m.cursoMultiId, fecha: dia("2026-05-05"), motivo: "Otro curso" }, m.profesorMultiId, m.multi);
    const delCurso = await servicio.listarSinClasesDeCurso(m.cursoId, { rol: "profesor", profesorId: m.profesorId });
    ok("el profesor del curso lee las marcas con su motivo", delCurso.some((c) => c.fecha.toISOString().slice(0, 10) === "2026-05-05" && c.motivo === "Motivo secreto"), true);
    ok("otro profesor no lee las marcas de un curso ajeno", (await falla(() => servicio.listarSinClasesDeCurso(m.cursoId, { rol: "profesor", profesorId: m.profesorMultiId }))).split(":")[0], "AuthorizationError");
    ok("administración y secretaría leen las marcas de cualquier curso", `${(await servicio.listarSinClasesDeCurso(m.cursoId, { rol: "admin" })).length > 0} ${(await servicio.listarSinClasesDeCurso(m.cursoId, { rol: "secretario" })).length > 0}`, "true true");
    const paraFamilia = await servicio.listarSinClasesDeAlumno(m.hijo1, { rol: "padre", padreId: m.padreId });
    ok("la familia ve las marcas del curso de su hijo", paraFamilia.some((c) => c.cursoId === m.cursoId && c.fecha.toISOString().slice(0, 10) === "2026-05-05"), true);
    ok("la familia no recibe la clave del motivo (ni vacía)", paraFamilia.every((c) => !("motivo" in c)), true);
    ok("la familia no ve las marcas de un curso donde su hijo no está", paraFamilia.every((c) => c.cursoId === m.cursoId), true);
    ok("la familia no ve a un alumno ajeno", (await falla(() => servicio.listarSinClasesDeAlumno(m.alumnoAjeno, { rol: "padre", padreId: m.padreId }))).split(":")[0], "AuthorizationError");
    const paraEquipo = await servicio.listarSinClasesDeAlumno(m.hijo1, { rol: "admin" });
    ok("el equipo sí ve el motivo", paraEquipo.some((c) => c.motivo === "Motivo secreto"), true);
    ok("un profesor también lee las de un alumno", (await servicio.listarSinClasesDeAlumno(m.hijo1, { rol: "profesor" })).length > 0, true);
    await quitar("2026-05-05");

    // Carrera: marcar y guardar asistencia de la misma clase a la vez nunca dejan las dos cosas
    let todasCoherentes = true;
    const detalle: string[] = [];
    for (const fecha of ["2026-04-09", "2026-04-14", "2026-04-16", "2026-04-21", "2026-04-23"]) {
      await Promise.allSettled([marcar(fecha, "Carrera"), guardar(fecha)]);
      const [nMarcas, nFilas] = [await marcas(fecha), await filas(fecha)];
      const coherente = (nMarcas === 1 && nFilas === 0) || (nMarcas === 0 && nFilas > 0);
      if (!coherente) todasCoherentes = false;
      detalle.push(`${nMarcas}/${nFilas}`);
    }
    ok(`marcar y guardar a la vez: siempre una sola de las dos cosas (${detalle.join(" ")})`, todasCoherentes, true);

    // Ciclo bloqueado
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: true } });
    ok("con el ciclo bloqueado no se puede marcar", (await falla(() => marcar("2026-04-28"))).split(":")[0], "ConflictError");
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: false } });
    await marcar("2026-04-28");
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: true } });
    ok("con el ciclo bloqueado no se puede quitar", (await falla(() => quitar("2026-04-28"))).split(":")[0], "ConflictError");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: false } });
    await prisma.pausaDelCiclo.deleteMany({ where: { id: PAUSA } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
