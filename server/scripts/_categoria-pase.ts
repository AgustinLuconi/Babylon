// Categorías personalizadas: valen para un alumno que está (o estuvo) inscripto en el curso de la categoría, aunque su curso
// actual ya sea otro (por ejemplo, tras un pase de año hecho antes de fin de año).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const resultado = async (f: () => Promise<unknown>) => {
  try {
    await f();
    return "ok";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};

(async () => {
  const m = await crearMundo(prisma);
  try {
    const c98 = `${P}-ciclo-2098`;
    await prisma.ciclo.create({ data: { id: c98, anio: 2098, activo: false } });
    const cursoViejo = `${P}-cviejo`;
    await prisma.curso.create({ data: { id: cursoViejo, nombre: "Pruebaav viejo", nivel: "kids", profesorId: m.profesorId, cicloId: c98, cupo: 10, estado: "activo" } });
    await prisma.categoriaPersonalizada.create({ data: { id: `${P}-cat-vieja`, cursoId: cursoViejo, profesorId: m.profesorId, nombre: "Pruebaav categoría vieja" } });
    await prisma.categoriaPersonalizada.create({ data: { id: `${P}-cat-ajena`, cursoId: m.cursoMultiId, profesorId: m.profesorMultiId, nombre: "Pruebaav categoría ajena" } });
    // hijo1: su curso actual es el del ciclo activo, pero estuvo inscripto en el curso viejo (2098).
    await prisma.inscripcion.create({ data: { id: `${P}-h1-i98`, alumnoId: m.hijo1, cursoId: cursoViejo, cicloId: c98, fecha: new Date(), aplicaDescuentoHermanos: false } });
    const crear = (categoria: string) => container.observacionService.crearObservacion({ alumnoId: m.hijo1, texto: "Pruebaav", categoria }, m.profe, "profesor");

    ok("categoría de un curso donde estuvo inscripto: se acepta", await resultado(() => crear(`${P}-cat-vieja`)), "ok");
    ok("categoría de su curso actual: se acepta (como siempre)", await resultado(async () => {
      await prisma.categoriaPersonalizada.create({ data: { id: `${P}-cat-actual`, cursoId: m.cursoId, profesorId: m.profesorId, nombre: "Pruebaav categoría actual" } });
      await crear(`${P}-cat-actual`);
    }), "ok");
    ok("categoría de un curso donde nunca estuvo: se rechaza", await resultado(() => crear(`${P}-cat-ajena`)), "ValidationError");
    ok("categoría que no existe: se rechaza", await resultado(() => crear("no-existe")), "ValidationError");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
