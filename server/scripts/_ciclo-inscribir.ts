// Bloqueo de ciclo en cursos y alumnos, e inscribir / cambiar de curso solo en el ciclo activo.
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { nuevoAlumnoSchema } from "../src/modules/alumnos/alumno.schema";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const { cicloService, cursoService, alumnoService } = container;

const resultado = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
    return "ok";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};

(async () => {
  const m = await crearMundo(prisma);
  let activoOriginal: string | null = null;
  try {
    const cicloViejo = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: cicloViejo, anio: 2099, activo: false } });
    const cursoViejo = `${P}-curso-2099`;
    await prisma.curso.create({ data: { id: cursoViejo, nombre: "Pruebaav 2099", nivel: "kids", profesorId: m.profesorId, cicloId: cicloViejo, cupo: 10, estado: "activo" } });
    const nuevo = (cursoId: string, nombre: string) =>
      nuevoAlumnoSchema.parse({ nombre, apellido: "Pruebaav", cursoId, responsable: { tipo: "existente", padreId: m.padreId, vinculo: "padre" } });

    // Cursos
    await cicloService.bloquearCiclo(cicloViejo);
    const datosCurso = { nombre: "Pruebaav Nuevo", nivel: "kids" as const, profesorId: m.profesorId, cicloId: cicloViejo, cupo: 10, horarios: [] };
    ok("crear un curso en un ciclo bloqueado: 409", await resultado(() => cursoService.crearCurso(datosCurso)), "ConflictError");
    ok("editar un curso de un ciclo bloqueado: 409", await resultado(() => cursoService.actualizarCurso(cursoViejo, { cupo: 12 })), "ConflictError");
    ok(
      "reemplazar horarios de un curso de un ciclo bloqueado: 409",
      await resultado(() => cursoService.actualizarCurso(cursoViejo, { horarios: [{ diaSemana: "lunes", horaInicio: "10:00", horaFin: "11:00" }] })),
      "ConflictError",
    );
    ok("el curso bloqueado no cambió", (await prisma.curso.findUniqueOrThrow({ where: { id: cursoViejo } })).cupo, 10);
    await cicloService.desbloquearCiclo(cicloViejo);
    ok("crear un curso con el ciclo abierto", await resultado(() => cursoService.crearCurso(datosCurso)), "ok");
    ok("editar un curso con el ciclo abierto", await resultado(() => cursoService.actualizarCurso(cursoViejo, { cupo: 12 })), "ok");

    // Inscribir solo en el ciclo activo
    ok("inscribir en un curso que no es del ciclo activo: 400", await resultado(() => alumnoService.inscribirAlumno(nuevo(cursoViejo, "Pruebaavuno"))), "ValidationError");
    ok("inscribir en un curso del ciclo activo", await resultado(() => alumnoService.inscribirAlumno(nuevo(m.cursoMultiId, "Pruebaavdos"))), "ok");
    ok("el alumno quedó inscripto en el ciclo activo", await prisma.inscripcion.count({ where: { cicloId: m.cicloId, alumno: { nombre: "Pruebaavdos" } } }), 1);

    // Cambiar de curso
    ok("cambiar a un curso que no es del ciclo activo: 400", await resultado(() => alumnoService.actualizarAlumno(m.hijo1, { cursoId: cursoViejo })), "ValidationError");
    ok("cambiar a un curso del ciclo activo", await resultado(() => alumnoService.actualizarAlumno(m.hijo1, { cursoId: m.cursoMultiId })), "ok");
    ok("la inscripción del ciclo activo cambió", (await prisma.inscripcion.findFirstOrThrow({ where: { alumnoId: m.hijo1, cicloId: m.cicloId } })).cursoId, m.cursoMultiId);

    // Lo que es de la persona sigue editable aunque su curso actual sea de un ciclo bloqueado
    await prisma.alumno.update({ where: { id: m.hijo2 }, data: { cursoId: cursoViejo } });
    await cicloService.bloquearCiclo(cicloViejo);
    ok("dar de baja con el curso en un ciclo bloqueado", await resultado(() => alumnoService.actualizarAlumno(m.hijo2, { estado: "inactivo" })), "ok");
    ok("reactivar con el curso en un ciclo bloqueado", await resultado(() => alumnoService.actualizarAlumno(m.hijo2, { estado: "activo" })), "ok");
    ok("editar datos personales", await resultado(() => alumnoService.actualizarAlumno(m.hijo2, { observacionesMedicas: "Pruebaav" })), "ok");
    ok(
      "cambiar de responsable",
      await resultado(() => alumnoService.asignarResponsable(m.hijo2, { tipo: "existente", padreId: m.padreAjenoId, vinculo: "tutor" })),
      "ok",
    );
    await cicloService.desbloquearCiclo(cicloViejo);

    // Sin ciclo activo no se inscribe
    activoOriginal = m.cicloId;
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { activo: false } });
    ok("inscribir sin ciclo activo: 400", await resultado(() => alumnoService.inscribirAlumno(nuevo(m.cursoMultiId, "Pruebaavtres"))), "ValidationError");
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { activo: true } });
    activoOriginal = null;
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    if (activoOriginal) await prisma.ciclo.update({ where: { id: activoOriginal }, data: { activo: true } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
