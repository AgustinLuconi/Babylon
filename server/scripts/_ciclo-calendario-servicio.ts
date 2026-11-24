// Servicio de ciclos: fechas y pausas (validaciones, bloqueo, anuncios) y la guarda del día de clases.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { CicloService } from "../src/modules/ciclos/ciclo.service";
import { crearVerificadorDeCiclo } from "../src/modules/ciclos/ciclo.guarda";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const cicloRepo = new PrismaCicloRepository(prisma);
const cursoRepo = new PrismaCursoRepository(prisma);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const anunciados: { dato: string; accion: string }[] = [];
tablero.alPublicarse("datos.cambiaron", async (d) => {
  anunciados.push({ dato: d.dato, accion: d.accion });
});
const verificador = crearVerificadorDeCiclo(cicloRepo, cursoRepo);
const servicio = new CicloService(cicloRepo, new PrismaUnitOfWork(prisma), tablero, verificador);
const CICLO = `${P}-ciclo-cal`;
const CURSO = `${P}-curso-cal`;

async function falla(f: () => Promise<unknown>): Promise<string> {
  try {
    await f();
    return "no falló";
  } catch (e) {
    return (e as Error).message;
  }
}
const dia = (iso: string) => iso.slice(0, 10);

(async () => {
  const m = await crearMundo(prisma);
  try {
    await prisma.ciclo.create({ data: { id: CICLO, anio: 2096, activo: false } });
    await prisma.curso.create({ data: { id: CURSO, nombre: "Pruebaav Cal", nivel: "kids", profesorId: m.profesorId, cicloId: CICLO, cupo: 10, estado: "activo" } });

    const lista = await servicio.listarCiclos();
    const mio = lista.find((c) => c.id === CICLO);
    ok("listarCiclos resuelve las fechas por defecto de un ciclo sin fechas", `${mio && dia(mio.inicio.toISOString())} ${mio && dia(mio.fin.toISOString())}`, "2096-03-01 2096-11-30");

    ok("editarFechas con inicio posterior al fin se rechaza", await falla(() => servicio.editarFechas(CICLO, { inicio: "2096-11-28", fin: "2096-03-16" })), "La fecha de inicio no puede ser posterior a la de fin");
    ok("editarFechas fuera del año se rechaza", await falla(() => servicio.editarFechas(CICLO, { inicio: "2095-12-31", fin: "2096-11-27" })), "Las fechas tienen que estar dentro del año 2096");
    const editado = await servicio.editarFechas(CICLO, { inicio: "2096-03-16", fin: "2096-11-27" });
    ok("editarFechas guarda inicio y fin", `${dia(editado.inicio.toISOString())} ${dia(editado.fin.toISOString())}`, "2096-03-16 2096-11-27");

    ok("una pausa fuera del ciclo se rechaza", await falla(() => servicio.agregarPausa(CICLO, { desde: "2096-12-01", hasta: "2096-12-02", nombre: "X", tipo: "otro" })), "La pausa tiene que estar dentro del ciclo lectivo");
    ok("una pausa con hasta antes que desde se rechaza", await falla(() => servicio.agregarPausa(CICLO, { desde: "2096-08-10", hasta: "2096-08-09", nombre: "X", tipo: "otro" })), "La pausa tiene que terminar el mismo día o después de empezar");
    const receso = await servicio.agregarPausa(CICLO, { desde: "2096-07-20", hasta: "2096-07-31", nombre: "Receso de invierno", tipo: "receso" });
    ok("una pausa superpuesta se rechaza", await falla(() => servicio.agregarPausa(CICLO, { desde: "2096-07-31", hasta: "2096-08-03", nombre: "X", tipo: "otro" })), 'La pausa se superpone con "Receso de invierno"');
    const feriado = await servicio.agregarPausa(CICLO, { desde: "2096-07-09", hasta: "2096-07-09", nombre: "Día de la Independencia", tipo: "feriado" });
    ok("listarCiclos trae las pausas ordenadas", ((await servicio.listarCiclos()).find((c) => c.id === CICLO)?.pausas ?? []).map((p) => p.nombre).join(","), "Día de la Independencia,Receso de invierno");

    // Un feriado es de un solo día (también en el servidor, no solo en la pantalla)
    ok("un feriado de varios días se rechaza", await falla(() => servicio.agregarPausa(CICLO, { desde: "2096-09-09", hasta: "2096-09-12", nombre: "X", tipo: "feriado" })), "Un feriado dura un solo día");
    ok("pasar un receso de varios días a feriado se rechaza", await falla(() => servicio.editarPausa(CICLO, receso.id, { tipo: "feriado" })), "Un feriado dura un solo día");
    ok("el receso no cambió", (await prisma.pausaDelCiclo.findUniqueOrThrow({ where: { id: receso.id } })).tipo, "receso");

    ok("editarFechas que deja una pausa afuera se rechaza nombrándola", await falla(() => servicio.editarFechas(CICLO, { inicio: "2096-08-01", fin: "2096-11-27" })), 'La pausa "Día de la Independencia" quedaría fuera del ciclo');
    ok("y no cambia nada", dia((await prisma.ciclo.findUniqueOrThrow({ where: { id: CICLO } })).inicio!.toISOString()), "2096-03-16");

    const editada = await servicio.editarPausa(CICLO, feriado.id, { nombre: "Independencia" });
    ok("editarPausa cambia el nombre", editada.nombre, "Independencia");
    ok("editarPausa que se superpone se rechaza", await falla(() => servicio.editarPausa(CICLO, receso.id, { desde: "2096-07-09" })), 'La pausa se superpone con "Independencia"');

    // La guarda del día de clases
    ok("día con clases: la guarda no lanza", await falla(() => verificador.verificarDiaDeClases(CURSO, "2096-04-14")), "no falló");
    ok("día fuera del ciclo: lanza", await falla(() => verificador.verificarDiaDeClases(CURSO, "2096-01-20")), "Ese día no hay clases: Fuera del ciclo lectivo");
    ok("día dentro de una pausa: lanza con su nombre", await falla(() => verificador.verificarDiaDeClases(CURSO, "2096-07-22")), "Ese día no hay clases: Receso de invierno");

    // Una pausa de otro ciclo no se toca desde este
    const otro = `${P}-ciclo-cal-otro`;
    await prisma.ciclo.create({ data: { id: otro, anio: 2097, activo: false } });
    ok("eliminar una pausa de otro ciclo da 404", await falla(() => servicio.eliminarPausa(otro, receso.id)), `Pausa con id ${receso.id} no encontrado/a`.replace(/.*/, (t) => t)); // el texto exacto lo fija EntityNotFoundError
    await servicio.eliminarPausa(CICLO, feriado.id);
    ok("eliminarPausa la quita", ((await servicio.listarCiclos()).find((c) => c.id === CICLO)?.pausas ?? []).length, 1);

    const antes = anunciados.length;
    await servicio.editarFechas(CICLO, { inicio: "2096-03-16", fin: "2096-11-26" });
    ok("cada escritura anuncia ciclos/edicion", `${anunciados.length - antes} ${anunciados[anunciados.length - 1]?.dato}/${anunciados[anunciados.length - 1]?.accion}`, "1 ciclos/edicion");
    const antesSinCambios = anunciados.length;
    await servicio.editarFechas(CICLO, { inicio: "2096-03-16", fin: "2096-11-26" });
    await servicio.editarPausa(CICLO, receso.id, {});
    await servicio.editarPausa(CICLO, receso.id, { nombre: "Receso de invierno", tipo: "receso" });
    ok("una edición que no cambia nada no escribe ni anuncia", anunciados.length - antesSinCambios, 0);
    await servicio.editarFechas(CICLO, { inicio: "2096-03-16", fin: "2096-11-27" });

    // Ciclo bloqueado: las cuatro operaciones se rechazan
    await prisma.ciclo.update({ where: { id: CICLO }, data: { bloqueado: true } });
    const mensajeBloqueo = "El ciclo 2096 está bloqueado. Pedile al administrador que lo desbloquee.";
    ok("bloqueado: editarFechas", await falla(() => servicio.editarFechas(CICLO, { inicio: "2096-03-16", fin: "2096-11-26" })), mensajeBloqueo);
    ok("bloqueado: agregarPausa", await falla(() => servicio.agregarPausa(CICLO, { desde: "2096-09-01", hasta: "2096-09-01", nombre: "X", tipo: "otro" })), mensajeBloqueo);
    ok("bloqueado: editarPausa", await falla(() => servicio.editarPausa(CICLO, receso.id, { nombre: "Y" })), mensajeBloqueo);
    ok("bloqueado: eliminarPausa", await falla(() => servicio.eliminarPausa(CICLO, receso.id)), mensajeBloqueo);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
