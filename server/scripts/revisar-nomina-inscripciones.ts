// Informe de SOLO LECTURA (no modifica nada): la lista de alumnos de un curso sale de las inscripciones, así que un
// alumno cuyo curso actual no tiene su inscripción dejaría de aparecer en la lista de ese curso. Uso:
//   pnpm exec tsx scripts/revisar-nomina-inscripciones.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

(async () => {
  const alumnos = await prisma.alumno.findMany({
    where: { cursoId: { not: null } },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      estado: true,
      cursoId: true,
      curso: { select: { nombre: true, ciclo: { select: { anio: true } } } },
      inscripciones: { select: { cursoId: true, ciclo: { select: { anio: true } }, curso: { select: { nombre: true } } } },
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
  const sin = alumnos.filter((a) => !a.inscripciones.some((i) => i.cursoId === a.cursoId));
  console.log(`Alumnos con curso actual: ${alumnos.length}`);
  console.log(`Con curso actual SIN inscripción en ese curso (dejarían de aparecer en su lista): ${sin.length}`);
  for (const a of sin) {
    const insc = a.inscripciones.map((i) => `${i.ciclo.anio}: ${i.curso.nombre}`).join(" | ") || "ninguna";
    console.log(`  - ${a.apellido}, ${a.nombre} [${a.estado}] curso actual: ${a.curso?.nombre} (${a.curso?.ciclo.anio}) · inscripciones: ${insc}`);
  }
  const porCurso = new Map<string, number>();
  for (const a of sin) porCurso.set(`${a.curso?.nombre} (${a.curso?.ciclo.anio})`, (porCurso.get(`${a.curso?.nombre} (${a.curso?.ciclo.anio})`) ?? 0) + 1);
  if (porCurso.size > 0) console.log("Cursos afectados:", [...porCurso].map(([c, n]) => `${c}: ${n}`).join("; "));
  await prisma.$disconnect();
})();
