// Estado "bloqueado" de un ciclo: bloquear/desbloquear, sus reglas de coherencia y los anuncios que publican.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { CicloService } from "../src/modules/ciclos/ciclo.service";
import { ok } from "./_check";
import { P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const cambios: { dato: string; accion: string }[] = [];
tablero.alPublicarse("datos.cambiaron", async (c) => {
  cambios.push({ dato: c.dato, accion: c.accion });
});
const servicio = new CicloService(new PrismaCicloRepository(prisma), new PrismaUnitOfWork(prisma), tablero);

const limpiar = () => prisma.ciclo.deleteMany({ where: { id: { startsWith: P } } });
const falla = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
    return "no falló";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};

(async () => {
  await limpiar();
  try {
    const c2099 = await servicio.crearCiclo({ anio: 2099 });
    await prisma.ciclo.update({ where: { id: c2099.id }, data: { id: `${P}-ciclo-2099` } });
    const id = `${P}-ciclo-2099`;
    const activo = await prisma.ciclo.findFirstOrThrow({ where: { activo: true } });

    ok("un ciclo nuevo nace sin bloquear", (await prisma.ciclo.findUniqueOrThrow({ where: { id } })).bloqueado, false);

    ok("bloquear un ciclo no activo", (await servicio.bloquearCiclo(id)).bloqueado, true);
    ok("bloquear uno ya bloqueado no falla", (await servicio.bloquearCiclo(id)).bloqueado, true);
    ok("queda guardado", (await prisma.ciclo.findUniqueOrThrow({ where: { id } })).bloqueado, true);
    ok("activar un ciclo bloqueado es 409", await falla(() => servicio.marcarActivo(id)), "ConflictError");
    ok("el ciclo activo sigue siendo el mismo", (await prisma.ciclo.findFirstOrThrow({ where: { activo: true } })).id, activo.id);

    ok("desbloquear", (await servicio.desbloquearCiclo(id)).bloqueado, false);
    ok("desbloquear uno que no está bloqueado no falla", (await servicio.desbloquearCiclo(id)).bloqueado, false);

    ok("bloquear el ciclo activo es 409", await falla(() => servicio.bloquearCiclo(activo.id)), "ConflictError");
    ok("el ciclo activo no quedó bloqueado", (await prisma.ciclo.findUniqueOrThrow({ where: { id: activo.id } })).bloqueado, false);
    ok("bloquear un ciclo inexistente", await falla(() => servicio.bloquearCiclo("no-existe")), "EntityNotFoundError");
    ok("desbloquear un ciclo inexistente", await falla(() => servicio.desbloquearCiclo("no-existe")), "EntityNotFoundError");

    ok("se publicó el bloqueo", cambios.some((c) => c.dato === "ciclos" && c.accion === "bloqueo"), true);
    ok("se publicó el desbloqueo", cambios.some((c) => c.dato === "ciclos" && c.accion === "desbloqueo"), true);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiar();
    await prisma.$disconnect();
  }
})();
