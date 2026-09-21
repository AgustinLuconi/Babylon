import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let ciclo2026 = await prisma.ciclo.findUnique({ where: { anio: 2026 } });
  if (!ciclo2026) {
    ciclo2026 = await prisma.ciclo.create({
      data: { id: randomUUID(), anio: 2026, activo: true },
    });
    console.log("Creado Ciclo 2026 (activo):", ciclo2026.id);
  } else {
    console.log("Ciclo 2026 ya existía:", ciclo2026.id);
  }

  const resultado = await prisma.curso.updateMany({
    where: { cicloId: null },
    data: { cicloId: ciclo2026.id },
  });
  console.log(`Cursos existentes asignados a Ciclo 2026: ${resultado.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
