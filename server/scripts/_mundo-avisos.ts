import { PrismaClient, type Rol } from "@prisma/client";
import bcrypt from "bcrypt";

// Mundo de prueba de los avisos, en el ciclo activo y con prefijo prueba-tmp-av en todo. limpiarMundo lo borra entero
// (las cuentas arrastran en cascada sus sesiones, enlaces y avisos).
export const P = "prueba-tmp-av";
export const CLAVE = "prueba1234";
export const email = (quien: string) => `${P}-${quien}@prueba.babylon.test`;

export interface Mundo {
  cicloId: string;
  admin: string; // cuenta admin
  secre: string; // cuenta secretario
  profe: string; // cuenta profesor
  profesorId: string;
  cursoId: string; // del profe: clases martes y jueves 14:00
  padre: string; // cuenta padre
  padreId: string;
  hijo1: string; // hijos del padre, en el curso del profe
  hijo2: string;
  multi: string; // cuenta admin + profesor
  profesorMultiId: string;
  cursoMultiId: string;
  ajeno: string; // cuenta de otro padre
  padreAjenoId: string;
  alumnoAjeno: string; // hijo del ajeno, en el curso de multi
}

export async function limpiarMundo(prisma: PrismaClient): Promise<void> {
  // Lo que las pruebas crean por la API tiene ids al azar: se reconoce por quien lo posee (el padre, el profesor o el
  // curso de prueba) o por el nombre "Pruebaav" con un DNI 9940xxxx.
  const padreIds = (
    await prisma.padre.findMany({
      where: { OR: [{ id: { startsWith: P } }, { email: { startsWith: P } }, { AND: [{ nombre: "Pruebaav" }, { OR: [{ dni: { startsWith: "9940" } }, { dni: null }] }] }] },
      select: { id: true },
    })
  ).map((x) => x.id);
  const alumnoIds = (
    await prisma.alumno.findMany({ where: { OR: [{ id: { startsWith: P } }, { padreId: { in: padreIds } }] }, select: { id: true } })
  ).map((a) => a.id);
  const profesorIds = (
    await prisma.profesor.findMany({ where: { OR: [{ id: { startsWith: P } }, { AND: [{ nombre: "Pruebaav" }, { dni: { startsWith: "9940" } }] }] }, select: { id: true } })
  ).map((x) => x.id);
  const cursoIds = (
    await prisma.curso.findMany({ where: { OR: [{ id: { startsWith: P } }, { profesorId: { in: profesorIds } }] }, select: { id: true } })
  ).map((c) => c.id);
  const deAlumnos = { alumnoId: { in: alumnoIds } };
  const deCursos = { cursoId: { in: cursoIds } };
  await prisma.pago.deleteMany({ where: { cuota: deAlumnos } });
  await prisma.cuota.deleteMany({ where: deAlumnos });
  await prisma.asistencia.deleteMany({ where: { OR: [deCursos, deAlumnos] } });
  await prisma.calificacion.deleteMany({ where: { OR: [{ evaluacion: deCursos }, deAlumnos] } });
  await prisma.evaluacion.deleteMany({ where: deCursos });
  await prisma.notaCierre.deleteMany({ where: { OR: [deCursos, deAlumnos] } });
  await prisma.observacion.deleteMany({ where: deAlumnos });
  await prisma.documento.deleteMany({ where: deAlumnos });
  await prisma.inscripcion.deleteMany({ where: { OR: [deAlumnos, deCursos] } });
  await prisma.alertaAutomatica.deleteMany({ where: { OR: [deAlumnos, deCursos] } });
  await prisma.alumno.deleteMany({ where: { id: { in: alumnoIds } } });
  // Avisos de descuento sobre alumnos que ya no existen (las pruebas que inscriben por la API los dejan en las cuentas reales
  // de administración; la clave lleva el id del alumno: "descuento:<alumnoId>:…").
  await prisma.$executeRaw`DELETE FROM "Notificacion" WHERE tipo::text IN ('descuento_hermanos', 'descuento_hermanos_instituto') AND split_part(clave, ':', 2) NOT IN (SELECT id FROM "Alumno")`;
  // Lo mismo con los avisos de las alertas automáticas (clave "alerta:<regla>:<alumnoId>[:<cursoId>]").
  await prisma.$executeRaw`DELETE FROM "Notificacion" WHERE tipo::text IN ('alumno_con_deuda', 'alumno_con_faltas', 'alumno_con_faltas_profesor') AND split_part(clave, ':', 3) NOT IN (SELECT id FROM "Alumno")`;
  await prisma.categoriaPersonalizada.deleteMany({ where: deCursos });
  await prisma.horario.deleteMany({ where: deCursos });
  await prisma.curso.deleteMany({ where: { id: { in: cursoIds } } });
  await prisma.mensaje.deleteMany({ where: { chat: { padreId: { in: padreIds } } } });
  await prisma.chat.deleteMany({ where: { padreId: { in: padreIds } } });
  await prisma.padre.deleteMany({ where: { id: { in: padreIds } } });
  await prisma.profesor.deleteMany({ where: { id: { in: profesorIds } } });
  await prisma.usuario.deleteMany({ where: { OR: [{ id: { startsWith: P } }, { email: { startsWith: P } }] } });
  // Ciclos de prueba (año 2098/2099): sus cursos e inscripciones ya se borraron arriba.
  await prisma.ciclo.deleteMany({ where: { id: { startsWith: P } } });
}

export async function crearMundo(prisma: PrismaClient): Promise<Mundo> {
  await limpiarMundo(prisma);
  const ciclo = await prisma.ciclo.findFirstOrThrow({ where: { activo: true } });
  const passwordHash = await bcrypt.hash(CLAVE, 10);
  const ahora = new Date();
  const cuenta = (quien: string, roles: Rol[]) =>
    prisma.usuario.create({
      data: { id: `${P}-${quien}`, nombre: `Pruebaav ${quien}`, email: email(quien), passwordHash, roles, estado: "activo", fechaCreacion: ahora },
    });
  await cuenta("admin", ["admin"]);
  await cuenta("secre", ["secretario"]);
  await cuenta("profe", ["profesor"]);
  await cuenta("padre", ["padre"]);
  await cuenta("ajeno", ["padre"]);
  await cuenta("multi", ["admin", "profesor"]);
  await prisma.profesor.create({ data: { id: `${P}-profe`, nombre: "Pruebaav", apellido: "Profe", usuarioId: `${P}-profe` } });
  await prisma.profesor.create({ data: { id: `${P}-multi`, nombre: "Pruebaav", apellido: "Multi", usuarioId: `${P}-multi` } });
  const curso = (id: string, nombre: string, profesorId: string) =>
    prisma.curso.create({ data: { id, nombre, nivel: "kids", profesorId, cicloId: ciclo.id, cupo: 30, estado: "activo" } });
  await curso(`${P}-curso`, "Pruebaav Kids", `${P}-profe`);
  await curso(`${P}-curso-multi`, "Pruebaav Multi", `${P}-multi`);
  for (const diaSemana of ["martes", "jueves"] as const) {
    await prisma.horario.create({ data: { id: `${P}-h-${diaSemana}`, cursoId: `${P}-curso`, diaSemana, horaInicio: "14:00", horaFin: "15:00" } });
  }
  const padre = (id: string, dni: string, usuarioId: string) =>
    prisma.padre.create({ data: { id, nombre: "Pruebaav", apellido: id.slice(P.length + 1), dni, usuarioId } });
  await padre(`${P}-padre`, "99400001", `${P}-padre`);
  await padre(`${P}-ajeno`, "99400002", `${P}-ajeno`);
  const alumno = async (id: string, nombre: string, dni: string, padreId: string, cursoId: string) => {
    await prisma.alumno.create({
      data: { id, nombre, apellido: "Pruebaav", dni, fechaNacimiento: new Date("2015-01-01T00:00:00Z"), fechaInscripcion: ahora, estado: "activo", padreId, cursoId, aplicaDescuentoHermanos: false },
    });
    await prisma.inscripcion.create({ data: { id: `${id}-insc`, alumnoId: id, cursoId, cicloId: ciclo.id, fecha: ahora, aplicaDescuentoHermanos: false } });
  };
  await alumno(`${P}-hijo1`, "Tomasav", "99400011", `${P}-padre`, `${P}-curso`);
  await alumno(`${P}-hijo2`, "Lunaav", "99400012", `${P}-padre`, `${P}-curso`);
  await alumno(`${P}-alumno-ajeno`, "Ajenoav", "99400013", `${P}-ajeno`, `${P}-curso-multi`);
  return {
    cicloId: ciclo.id,
    admin: `${P}-admin`,
    secre: `${P}-secre`,
    profe: `${P}-profe`,
    profesorId: `${P}-profe`,
    cursoId: `${P}-curso`,
    padre: `${P}-padre`,
    padreId: `${P}-padre`,
    hijo1: `${P}-hijo1`,
    hijo2: `${P}-hijo2`,
    multi: `${P}-multi`,
    profesorMultiId: `${P}-multi`,
    cursoMultiId: `${P}-curso-multi`,
    ajeno: `${P}-ajeno`,
    padreAjenoId: `${P}-ajeno`,
    alumnoAjeno: `${P}-alumno-ajeno`,
  };
}

// Desde la consola: tsx scripts/_mundo-avisos.ts crear|borrar|sincronizar (para las pruebas de la API y del navegador).
if (require.main === module) {
  const prisma = new PrismaClient();
  const accion = process.argv[2];
  const tarea =
    accion === "crear"
      ? crearMundo(prisma)
      : accion === "sincronizar"
        ? import("../src/container").then(({ container }) => container.notificacionService.sincronizarTodo())
        : limpiarMundo(prisma);
  tarea
    .then(() => console.log(`mundo de prueba: ${accion}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    // El container deja su propia conexión a la base abierta: se sale explícitamente.
    .finally(async () => {
      await prisma.$disconnect();
      process.exit();
    });
}
