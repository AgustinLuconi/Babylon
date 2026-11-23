// Datos del calendario del ciclo: fechas opcionales en Ciclo, pausas (PausaDelCiclo) y el día de vencimiento de Configuracion.
import { PrismaClient } from "@prisma/client";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { ok } from "./_check";

const prisma = new PrismaClient();
const repo = new PrismaCicloRepository(prisma);
const CICLO = "prueba-tmp-cal-ciclo";
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

(async () => {
  try {
    await prisma.pausaDelCiclo?.deleteMany({ where: { cicloId: CICLO } });
    await prisma.ciclo.deleteMany({ where: { id: CICLO } });
    await prisma.ciclo.create({ data: { id: CICLO, anio: 2095, activo: false } });
    const sinFechas = await repo.findById(CICLO);
    ok("un ciclo creado sin fechas vuelve con inicio y fin null", `${sinFechas?.inicio} ${sinFechas?.fin}`, "null null");

    await repo.crearPausa({ id: `${CICLO}-p2`, cicloId: CICLO, desde: dia("2095-07-20"), hasta: dia("2095-07-31"), nombre: "Receso", tipo: "receso" });
    await repo.crearPausa({ id: `${CICLO}-p1`, cicloId: CICLO, desde: dia("2095-07-09"), hasta: dia("2095-07-09"), nombre: "Feriado", tipo: "feriado" });
    const pausas = await repo.findPausasByCicloId(CICLO);
    ok("las pausas vuelven ordenadas por desde", pausas.map((p) => p.nombre).join(","), "Feriado,Receso");
    ok("findPausaById la encuentra", (await repo.findPausaById(`${CICLO}-p1`))?.tipo, "feriado");
    const cambiada = await repo.actualizarPausa(`${CICLO}-p1`, { nombre: "Día de la Independencia" });
    ok("actualizarPausa cambia el nombre", cambiada.nombre, "Día de la Independencia");

    await prisma.ciclo.update({ where: { id: CICLO }, data: { inicio: dia("2095-03-16"), fin: dia("2095-11-27") } });
    const bloqueado = await prisma.$transaction((tx) => repo.bloquearParaLectura(CICLO, tx));
    ok("bloquearParaLectura devuelve inicio y fin", `${bloqueado?.inicio?.toISOString().slice(0, 10)} ${bloqueado?.fin?.toISOString().slice(0, 10)}`, "2095-03-16 2095-11-27");

    let borrar = "borró";
    await prisma.ciclo.delete({ where: { id: CICLO } }).catch(() => (borrar = "falló"));
    ok("borrar un ciclo con pausas falla (RESTRICT)", borrar, "falló");

    let soloInicio = "aceptó";
    await prisma.ciclo.update({ where: { id: CICLO }, data: { fin: null } }).catch(() => (soloInicio = "rechazó"));
    ok("inicio sin fin lo rechaza la base (CHECK)", soloInicio, "rechazó");
    let invertida = "aceptó";
    await repo.crearPausa({ id: `${CICLO}-p3`, cicloId: CICLO, desde: dia("2095-08-10"), hasta: dia("2095-08-09"), nombre: "Mal", tipo: "otro" }).catch(() => (invertida = "rechazó"));
    ok("una pausa con hasta antes que desde la rechaza la base (CHECK)", invertida, "rechazó");

    await repo.eliminarPausa(`${CICLO}-p1`);
    ok("eliminarPausa la quita", (await repo.findPausasByCicloId(CICLO)).length, 1);

    ok("Configuracion.diaVencimiento es 10 por defecto", (await prisma.configuracion.findFirstOrThrow()).diaVencimiento, 10);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.pausaDelCiclo?.deleteMany({ where: { cicloId: CICLO } });
    await prisma.ciclo.deleteMany({ where: { id: CICLO } });
    await prisma.$disconnect();
    process.exit(0);
  }
})();
