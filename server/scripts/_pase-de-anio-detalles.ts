// Pase de año, detalles de los descuentos por hermanos: la marca final queda en la inscripción del ciclo de destino (sin
// reescribir la del origen) y un hermano cuya marca cambia sin moverse también recibe su señal.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { AlumnoService } from "../src/modules/alumnos/alumno.service";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaProfesorRepository } from "../src/modules/profesores/profesor.repository.prisma";
import { container } from "../src/container";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);

(async () => {
  const m = await crearMundo(prisma);
  try {
    const [c98, c99] = [`${P}-ciclo-2098`, `${P}-ciclo-2099`];
    for (const [id, anio] of [[c98, 2098], [c99, 2099]] as const) await prisma.ciclo.create({ data: { id, anio, activo: false } });
    const cursoViejo = `${P}-c1`;
    const cursoNuevo = `${P}-c2`;
    await prisma.curso.create({ data: { id: cursoViejo, nombre: "Pruebaav viejo", nivel: "kids", profesorId: m.profesorId, cicloId: c98, cupo: 10, estado: "activo" } });
    await prisma.curso.create({ data: { id: cursoNuevo, nombre: "Pruebaav nuevo", nivel: "kids", profesorId: m.profesorId, cicloId: c99, cupo: 10, estado: "activo" } });
    const familia = async (id: string) => prisma.padre.create({ data: { id: `${P}-${id}`, nombre: "Pruebaav", apellido: id, dni: `9942${id === "f1" ? "0001" : "0002"}` } });
    await familia("f1");
    await familia("f2");
    const dia = (n: number) => new Date(Date.UTC(2090, 0, n));
    const alumno = async (id: string, padre: string, dias: number, aplica: boolean, conInscripcion = true) => {
      await prisma.alumno.create({
        data: { id: `${P}-${id}`, nombre: `Pruebaav${id}`, apellido: "Pruebaav", fechaInscripcion: dia(dias), estado: "activo", padreId: `${P}-${padre}`, cursoId: cursoViejo, aplicaDescuentoHermanos: aplica },
      });
      if (conInscripcion) await prisma.inscripcion.create({ data: { id: `${P}-${id}-i98`, alumnoId: `${P}-${id}`, cursoId: cursoViejo, cicloId: c98, fecha: dia(dias), aplicaDescuentoHermanos: aplica } });
    };
    // Familia 1: s1 (el más antiguo) deja de continuar y s2 pasa: s2 pasa a pagar completo.
    await alumno("s1", "f1", 1, false);
    await alumno("s2", "f1", 2, true);
    await alumno("s3", "f1", 3, true, false);
    // Familia 2: t1 deja de continuar y t3 pasa; t2 (que no se mueve) pasa a pagar completo.
    await alumno("t1", "f2", 1, false);
    await alumno("t2", "f2", 2, true, false);
    await alumno("t3", "f2", 3, true);

    const senales: { dato: string; accion: string; alumnoIds: string[] }[] = [];
    const tablero = new TableroDeAnuncios<EventosDelSistema>();
    tablero.alPublicarse("datos.cambiaron", async (c) => {
      senales.push({ dato: c.dato, accion: c.accion, alumnoIds: c.ids.alumnoIds ?? [] });
    });
    const cicloRepo = new PrismaCicloRepository(prisma);
    const servicio = new AlumnoService(new PrismaAlumnoRepository(prisma), new PrismaCursoRepository(prisma), new PrismaProfesorRepository(prisma), cicloRepo, new PrismaPadreRepository(prisma), {} as never, container.cuotaService, uow, tablero);
    const pasa = (alumno: string) => ({ alumnoId: `${P}-${alumno}`, destino: { tipo: "pasa" as const, cursoId: cursoNuevo, cicloId: c99 } });
    await uow.runInTransaction((tx) => servicio.registrarPaseDeAnio([{ alumnoId: `${P}-s1`, destino: { tipo: "no-continua" } }, pasa("s2")], c99, tx));
    await uow.runInTransaction((tx) => servicio.registrarPaseDeAnio([{ alumnoId: `${P}-t1`, destino: { tipo: "no-continua" } }, pasa("t3")], c99, tx));

    const inscripcion = (alumnoId: string, cicloId: string) => prisma.inscripcion.findUnique({ where: { alumnoId_cicloId: { alumnoId: `${P}-${alumnoId}`, cicloId } } });
    const marca = async (alumnoId: string) => (await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-${alumnoId}` } })).aplicaDescuentoHermanos;
    ok("s2 paga completo desde el pase (marca del alumno)", await marca("s2"), false);
    ok("s2: la inscripción nueva lleva la marca final", (await inscripcion("s2", c99))?.aplicaDescuentoHermanos, false);
    ok("s2: la inscripción vieja (historia) no se reescribe", (await inscripcion("s2", c98))?.aplicaDescuentoHermanos, true);

    ok("t2, que no se movió, pasó a pagar completo", await marca("t2"), false);
    const delDescuento = senales.filter((s) => s.accion === "descuento").flatMap((s) => s.alumnoIds);
    ok("t2 recibe la señal del cambio de descuento", delDescuento.includes(`${P}-t2`), true);
    ok("s2 y t3 (los que pasaron) no repiten señal de descuento", delDescuento.includes(`${P}-s2`) || delDescuento.includes(`${P}-t3`), false);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.padre.deleteMany({ where: { id: { startsWith: `${P}-f` } } });
    await prisma.$disconnect();
    process.exit(0);
  }
})();
