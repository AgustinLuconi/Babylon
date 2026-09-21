import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Alumnos creados antes de que `AlumnoService.inscribirAlumno` empezara a
// escribir `Inscripcion` (o importados sin ese paso) pueden tener un
// `cursoId` real pero ningún registro de inscripción para el ciclo activo
// — sin esto, "alumnos del ciclo activo" los deja afuera aunque sí estén
// cursando.
async function main() {
  const cicloActivo = await prisma.ciclo.findFirst({ where: { activo: true } });
  if (!cicloActivo) {
    console.log("No hay ningún ciclo activo — nada para hacer.");
    return;
  }

  // Solo alumnos cuyo curso ACTUAL pertenece de verdad al ciclo activo —
  // si el alumno quedó con el cursoId de un ciclo viejo (ej. importado del
  // 2025 y nunca reinscripto), no corresponde inventarle una inscripción
  // 2026 con un curso que en realidad es de 2025.
  const alumnosConCurso = await prisma.alumno.findMany({
    where: { curso: { cicloId: cicloActivo.id } },
  });
  let creadas = 0;
  for (const alumno of alumnosConCurso) {
    if (!alumno.cursoId) continue;
    const existente = await prisma.inscripcion.findUnique({
      where: { alumnoId_cicloId: { alumnoId: alumno.id, cicloId: cicloActivo.id } },
    });
    if (existente) continue;

    await prisma.inscripcion.create({
      data: {
        id: randomUUID(),
        alumnoId: alumno.id,
        cursoId: alumno.cursoId,
        cicloId: cicloActivo.id,
        fecha: alumno.fechaInscripcion,
        aplicaDescuentoHermanos: alumno.aplicaDescuentoHermanos,
      },
    });
    creadas++;
  }
  console.log(`Ciclo activo: ${cicloActivo.anio}. Inscripciones creadas: ${creadas} de ${alumnosConCurso.length} alumnos con curso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
