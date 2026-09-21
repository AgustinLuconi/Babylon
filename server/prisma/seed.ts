import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

async function main() {
  const hash = (password: string) => bcrypt.hashSync(password, 10);

  const admin = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: "Silvana Linares",
      email: "admin@babylon.test",
      passwordHash: hash("admin1234"),
      // Ejemplo de cuenta multi-rol: la dueña del instituto también dicta
      // clases. Al loguearse va a tener que elegir con cuál de los dos entra.
      roles: ["admin", "profesor"],
      estado: "activo",
      fechaCreacion: new Date(),
    },
  });

  const secretarioUsuario = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: "Lucía Peralta",
      email: "secretario@babylon.test",
      passwordHash: hash("secretario1234"),
      roles: ["secretario"],
      estado: "activo",
      fechaCreacion: new Date(),
    },
  });

  const profesorUsuario = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: "Martín Aristiaran",
      email: "profesor@babylon.test",
      passwordHash: hash("profesor1234"),
      roles: ["profesor"],
      estado: "activo",
      fechaCreacion: new Date(),
    },
  });

  const padreUsuario = await prisma.usuario.create({
    data: {
      id: randomUUID(),
      nombre: "Roberto Rodríguez",
      email: "padre@babylon.test",
      passwordHash: hash("padre1234"),
      roles: ["padre"],
      estado: "activo",
      fechaCreacion: new Date(),
    },
  });

  const profesor = await prisma.profesor.create({
    data: {
      id: randomUUID(),
      nombre: "Martín",
      apellido: "Aristiaran",
      dni: "22222222",
      email: profesorUsuario.email,
      usuarioId: profesorUsuario.id,
    },
  });

  // Silvana también dicta clases (cuenta multi-rol admin+profesor) — su
  // Profesor real, distinto del de Martín, vinculado a su mismo usuarioId.
  await prisma.profesor.create({
    data: {
      id: randomUUID(),
      nombre: "Silvana",
      apellido: "Linares",
      dni: "44444444",
      email: admin.email,
      usuarioId: admin.id,
    },
  });

  const padre = await prisma.padre.create({
    data: {
      id: randomUUID(),
      nombre: "Roberto",
      apellido: "Rodríguez",
      dni: "33333333",
      email: padreUsuario.email,
      vinculo: "padre",
      usuarioId: padreUsuario.id,
    },
  });

  const curso = await prisma.curso.create({
    data: {
      id: randomUUID(),
      nombre: "Adults B1",
      nivel: "adults_b1",
      profesorId: profesor.id,
      cupo: 15,
      estado: "activo",
    },
  });

  await prisma.horario.create({
    data: {
      id: randomUUID(),
      cursoId: curso.id,
      diaSemana: "lunes",
      horaInicio: "18:00",
      horaFin: "19:30",
    },
  });

  const alumno = await prisma.alumno.create({
    data: {
      id: randomUUID(),
      nombre: "Valentina",
      apellido: "Rodríguez",
      dni: "11111111",
      fechaNacimiento: new Date("2015-03-01"),
      fechaInscripcion: new Date(),
      estado: "activo",
      padreId: padre.id,
      cursoId: curso.id,
      aplicaDescuentoHermanos: false,
    },
  });

  await prisma.cuota.create({
    data: {
      id: randomUUID(),
      alumnoId: alumno.id,
      mes: 7,
      anio: 2026,
      montoBase: 20000,
      descuento: 0,
      montoFinal: 20000,
      vencimiento: new Date("2026-07-10"),
      estado: "vencida",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
