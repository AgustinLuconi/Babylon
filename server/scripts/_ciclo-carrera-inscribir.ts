// Carrera: inscribir en un curso del ciclo activo mientras otra persona activa otro ciclo. La inscripción tiene que esperar
// y, al terminar la activación, rechazarse (el curso ya no es del ciclo activo): nunca una inscripción en un ciclo con un
// curso de otro (el caso de Valentino).
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { container } from "../src/container";
import { nuevoAlumnoSchema } from "../src/modules/alumnos/alumno.schema";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = await crearMundo(prisma);
  try {
    const otro = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: otro, anio: 2099, activo: false } });
    let verificado!: () => void;
    const yaActivo = new Promise<void>((r) => (verificado = r));
    let soltar!: () => void;
    const puedeTerminar = new Promise<void>((r) => (soltar = r));
    // Otra persona activa el ciclo 2099 y todavía no confirma.
    const activacion = uow.runInTransaction(async (tx) => {
      await container.cicloService.activarEnTransaccion(otro, tx);
      verificado();
      await puedeTerminar;
    });
    await yaActivo;
    const datos = nuevoAlumnoSchema.parse({ nombre: "Pruebaavcarrera", apellido: "Pruebaav", cursoId: m.cursoMultiId, responsable: { tipo: "existente", padreId: m.padreId, vinculo: "padre" } });
    let resultado = "pendiente";
    const inscripcion = container.alumnoService.inscribirAlumno(datos).then(() => (resultado = "ok"), (e) => (resultado = (e as Error).constructor.name));
    await espera(400);
    ok("la inscripción espera a que termine la activación", resultado, "pendiente");
    soltar();
    await activacion;
    await inscripcion;
    ok("terminada la activación, la inscripción se rechaza", resultado, "ValidationError");
    ok("no quedó ninguna inscripción nueva", await prisma.inscripcion.count({ where: { alumno: { nombre: "Pruebaavcarrera" } } }), 0);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { activo: true } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
