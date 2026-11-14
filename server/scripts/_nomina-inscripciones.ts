// La lista de alumnos de un curso sale de las inscripciones: un curso viejo sigue mostrando a quienes cursaron en él.
// Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { cargarCalificacionesSchema, crearEvaluacionSchema } from "../src/modules/calificaciones/calificacion.schema";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaAlumnoRepository(prisma);

async function token(quien: string): Promise<string> {
  const r = await fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
const nominaPor = async (t: string, cursoId: string) =>
  ((await (await fetch(`http://localhost:4000/api/cursos/${cursoId}/alumnos`, { headers: { Authorization: `Bearer ${t}` } })).json()) as { id: string }[]).map((a) => a.id.replace(`${P}-`, "")).sort().join(",");

(async () => {
  const m = await crearMundo(prisma);
  try {
    const ciclo = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: ciclo, anio: 2099, activo: false } });
    const viejo = `${P}-curso-2099`;
    await prisma.curso.create({ data: { id: viejo, nombre: "Pruebaav 2099", nivel: "kids", profesorId: m.profesorId, cicloId: ciclo, cupo: 10, estado: "activo" } });
    const alumno = (id: string, cursoId: string) =>
      prisma.alumno.create({ data: { id: `${P}-${id}`, nombre: `Pruebaav${id}`, apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, cursoId, aplicaDescuentoHermanos: false } });
    // x cursó en el curso viejo (2099) y ahora está en el curso actual: aparece en los dos.
    await alumno("x", m.cursoId);
    await prisma.inscripcion.create({ data: { id: `${P}-x-viejo`, alumnoId: `${P}-x`, cursoId: viejo, cicloId: ciclo, fecha: new Date(), aplicaDescuentoHermanos: false } });
    await prisma.inscripcion.create({ data: { id: `${P}-x-actual`, alumnoId: `${P}-x`, cursoId: m.cursoId, cicloId: m.cicloId, fecha: new Date(), aplicaDescuentoHermanos: false } });
    // y figura con el curso viejo como curso actual pero sin inscripción en él: no aparece.
    await alumno("y", viejo);

    const ids = async (cursoId: string) => (await repo.findByCursoId(cursoId)).map((a) => a.id.replace(`${P}-`, "")).sort().join(",");
    ok("el curso viejo muestra a quien cursó en él", await ids(viejo), "x");
    ok("el curso actual muestra a sus alumnos inscriptos (una sola vez cada uno)", await ids(m.cursoId), "hijo1,hijo2,x");
    ok("sin inscripción no aparece aunque su curso actual sea ese", (await ids(viejo)).includes("y"), false);

    // La validación de nómina al cargar notas usa la misma lista
    const evaluacion = await container.calificacionService.crearEvaluacion(
      crearEvaluacionSchema.parse({ cursoId: viejo, nombre: "Pruebaav eval", tipo: "examen", fecha: new Date().toISOString().slice(0, 10), periodo: "julio" }),
      m.profesorId,
    );
    let resultado = "ok";
    try {
      await container.calificacionService.cargarCalificaciones(evaluacion.id, cargarCalificacionesSchema.parse({ notas: [{ alumnoId: `${P}-x`, nota: "8" }] }), m.profesorId);
    } catch (e) {
      resultado = (e as Error).message;
    }
    ok("se cargan notas a quien solo tiene inscripción en el curso", resultado, "ok");

    // Un alumno dado de baja: administración lo ve en el curso viejo, el profesor no
    await prisma.alumno.update({ where: { id: `${P}-x` }, data: { estado: "inactivo" } });
    ok("administración ve al dado de baja en el curso viejo", await nominaPor(await token("admin"), viejo), "x");
    ok("el profesor no ve al dado de baja", await nominaPor(await token("profe"), viejo), "");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
