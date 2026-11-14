// La guarda verificarCicloAbierto: rechaza con el mensaje exacto, resuelve el ciclo de un curso y, al estar tomada con
// un bloqueo compartido, hace esperar a un bloqueo simultáneo hasta que termine la escritura.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { crearVerificadorDeCiclo } from "../src/modules/ciclos/ciclo.guarda";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { CicloService } from "../src/modules/ciclos/ciclo.service";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const cicloRepo = new PrismaCicloRepository(prisma);
const servicio = new CicloService(cicloRepo, uow);
const guarda = crearVerificadorDeCiclo(cicloRepo, new PrismaCursoRepository(prisma));

const falla = async (f: () => Promise<unknown>): Promise<{ tipo: string; mensaje: string }> => {
  try {
    await f();
    return { tipo: "no falló", mensaje: "" };
  } catch (e) {
    return { tipo: (e as Error).constructor.name, mensaje: (e as Error).message };
  }
};
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = await crearMundo(prisma);
  try {
    const id = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id, anio: 2099, activo: false } });
    const cursoId = `${P}-curso-2099`;
    await prisma.curso.create({ data: { id: cursoId, nombre: "Pruebaav curso 2099", nivel: "kids", profesorId: m.profesorId, cicloId: id, cupo: 10, estado: "activo" } });

    ok("ciclo abierto: no lanza", (await falla(() => guarda.verificarCicloAbierto(id))).tipo, "no falló");
    await servicio.bloquearCiclo(id);
    const r = await falla(() => guarda.verificarCicloAbierto(id));
    ok("ciclo bloqueado: ConflictError", r.tipo, "ConflictError");
    ok("mensaje exacto", r.mensaje, "El ciclo 2099 está bloqueado. Pedile al administrador que lo desbloquee.");
    ok("por el curso: bloqueado", (await falla(() => guarda.verificarCicloDelCurso(cursoId))).tipo, "ConflictError");
    ok("curso inexistente", (await falla(() => guarda.verificarCicloDelCurso("no-existe"))).tipo, "EntityNotFoundError");
    ok("ciclo inexistente", (await falla(() => guarda.verificarCicloAbierto("no-existe"))).tipo, "EntityNotFoundError");
    await servicio.desbloquearCiclo(id);
    ok("por el curso: abierto", (await falla(() => guarda.verificarCicloDelCurso(cursoId))).tipo, "no falló");

    // Concurrencia: una escritura que ya verificó el ciclo hace esperar a un bloqueo hasta confirmar.
    let verificado!: () => void;
    const yaVerifico = new Promise<void>((r) => (verificado = r));
    let soltar!: () => void;
    const puedeTerminar = new Promise<void>((r) => (soltar = r));
    const escritura = uow.runInTransaction(async (tx) => {
      await guarda.verificarCicloAbierto(id, tx);
      verificado();
      await puedeTerminar;
    });
    await yaVerifico;
    let bloqueoTermino = false;
    const bloqueo = servicio.bloquearCiclo(id).then(() => (bloqueoTermino = true));
    await espera(300);
    ok("el bloqueo espera a la escritura en curso", bloqueoTermino, false);
    soltar();
    await escritura;
    await bloqueo;
    ok("terminada la escritura, el ciclo queda bloqueado", (await prisma.ciclo.findUniqueOrThrow({ where: { id } })).bloqueado, true);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
  }
})();
