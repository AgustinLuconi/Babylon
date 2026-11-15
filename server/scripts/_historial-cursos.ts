// Historial de cursos de un alumno (una fila por ciclo, desde las inscripciones): servicio y ruta (solo administración y
// secretaría). Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const API = "http://localhost:4000";
const token = async (quien: string) =>
  ((await (await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) })).json()) as { token: string }).token;
const pedir = async (ruta: string, tk: string) => {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${tk}` } });
  const t = await r.text();
  return { status: r.status, d: t ? JSON.parse(t) : null };
};

(async () => {
  const m = await crearMundo(prisma);
  try {
    const [c98, c99] = [`${P}-ciclo-2098`, `${P}-ciclo-2099`];
    for (const [id, anio] of [[c98, 2098], [c99, 2099]] as const) await prisma.ciclo.create({ data: { id, anio, activo: false } });
    for (const [id, nombre, cicloId] of [["c1", "Pruebaav Uno", c98], ["c2", "Pruebaav Dos", c99]] as const) {
      await prisma.curso.create({ data: { id: `${P}-${id}`, nombre, nivel: "kids", profesorId: m.profesorId, cicloId, cupo: 10, estado: "activo" } });
    }
    const alumno = `${P}-h1`;
    await prisma.alumno.create({ data: { id: alumno, nombre: "Pruebaavh1", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, cursoId: `${P}-c2`, aplicaDescuentoHermanos: false } });
    await prisma.inscripcion.create({ data: { id: `${P}-h1-i98`, alumnoId: alumno, cursoId: `${P}-c1`, cicloId: c98, fecha: new Date("2098-03-02T00:00:00Z"), aplicaDescuentoHermanos: true } });
    await prisma.inscripcion.create({ data: { id: `${P}-h1-i99`, alumnoId: alumno, cursoId: `${P}-c2`, cicloId: c99, fecha: new Date("2099-03-01T00:00:00Z"), aplicaDescuentoHermanos: false } });

    const h = await container.alumnoService.listarHistorialDeCursos(alumno);
    ok("historial: una fila por ciclo, el más nuevo primero", h.map((f) => f.anio).join(","), "2099,2098");
    ok("historial: nombres de curso", h.map((f) => f.cursoNombre).join(","), "Pruebaav Dos,Pruebaav Uno");
    ok("historial: el curso actual está marcado", h.map((f) => f.actual).join(","), "true,false");
    ok("historial: descuento de cada año", h.map((f) => f.aplicaDescuentoHermanos).join(","), "false,true");
    ok("historial: fecha de inscripción", h[1].fecha.toISOString().slice(0, 10), "2098-03-02");
    await prisma.alumno.create({ data: { id: `${P}-sin`, nombre: "Pruebaavsin", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, aplicaDescuentoHermanos: false } });
    ok("alumno sin inscripciones: vacío", (await container.alumnoService.listarHistorialDeCursos(`${P}-sin`)).length, 0);
    let error = "ninguno";
    try {
      await container.alumnoService.listarHistorialDeCursos("no-existe");
    } catch (e) {
      error = (e as Error).constructor.name;
    }
    ok("alumno inexistente", error, "EntityNotFoundError");

    // Ruta: administración y secretaría sí; profesor y familia no
    const ruta = `/api/alumnos/${alumno}/historial-cursos`;
    const admin = await pedir(ruta, await token("admin"));
    ok("admin: 200 con las dos filas", `${admin.status} ${admin.d?.length}`, "200 2");
    ok("secretaría: 200", (await pedir(ruta, await token("secre"))).status, 200);
    ok("profesor: 403", (await pedir(ruta, await token("profe"))).status, 403);
    ok("la familia del alumno: 200", (await pedir(ruta, await token("padre"))).status, 200);
    ok("otra familia: 403", (await pedir(ruta, await token("ajeno"))).status, 403);

    // Las notas llevan el curso de su evaluación (para separar por año en las pantallas)
    await prisma.evaluacion.create({ data: { id: `${P}-ev1`, cursoId: `${P}-c1`, nombre: "Pruebaav eval", tipo: "examen", fecha: new Date("2098-05-05T00:00:00Z"), periodo: "julio", estado: "publicada" } });
    await prisma.calificacion.create({ data: { id: `${P}-nota1`, evaluacionId: `${P}-ev1`, alumnoId: alumno, nota: "8" } });
    const notas = await pedir(`/api/calificaciones/alumnos/${alumno}`, await token("padre"));
    ok("la familia ve la nota con el curso de su evaluación", `${notas.status} ${notas.d?.[0]?.cursoId}`, `200 ${P}-c1`);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
