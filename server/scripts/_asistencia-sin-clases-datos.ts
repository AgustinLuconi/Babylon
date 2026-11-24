// Datos de las clases sin dictar: una marca por (curso, día), con su motivo, y lo que necesita el servicio para leerlas.
import { PrismaClient } from "@prisma/client";
import { PrismaAsistenciaRepository } from "../src/modules/asistencia/asistencia.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaAsistenciaRepository(prisma);
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
async function mensaje(f: () => Promise<unknown>): Promise<string> {
  try {
    await f();
    return "no falló";
  } catch (e) {
    return (e as Error).message;
  }
}

(async () => {
  const m = await crearMundo(prisma);
  try {
    const marca = (id: string, cursoId: string, fecha: string, motivo?: string) => ({ id: `${P}-sc-${id}`, cursoId, fecha: dia(fecha), motivo, registradaPor: m.profe, creadaEn: new Date() });
    await repo.crearClaseSinDictar(marca("a", m.cursoId, "2026-03-17", "Corte de luz"));
    const hallada = await repo.findClaseSinDictar(m.cursoId, dia("2026-03-17"));
    ok("se encuentra por curso y día, con su motivo", `${hallada?.id} ${hallada?.motivo}`, `${P}-sc-a Corte de luz`);
    ok("una marca sin motivo vuelve con el motivo sin definir", (await repo.crearClaseSinDictar(marca("b", m.cursoId, "2026-03-19"))).motivo, undefined);
    ok("no se puede marcar dos veces el mismo curso y día", (await mensaje(() => repo.crearClaseSinDictar(marca("dup", m.cursoId, "2026-03-17")))) !== "no falló", true);
    ok("el mismo día en otro curso es otra marca", (await repo.crearClaseSinDictar(marca("c", m.cursoMultiId, "2026-03-17"))).cursoId, m.cursoMultiId);

    const actualizada = await repo.actualizarMotivoDeClaseSinDictar(`${P}-sc-a`, "Paro de transporte");
    ok("se cambia el motivo", actualizada.motivo, "Paro de transporte");
    ok("y se borra el motivo", (await repo.actualizarMotivoDeClaseSinDictar(`${P}-sc-a`, null)).motivo, undefined);

    ok("las del curso, la más nueva primero", (await repo.findSinDictarByCursoId(m.cursoId)).map((c) => c.fecha.toISOString().slice(0, 10)).join(","), "2026-03-19,2026-03-17");
    await prisma.inscripcion.updateMany({ where: { id: { startsWith: P } }, data: { fecha: dia("2026-03-01") } });
    ok("las de un alumno salen de los cursos donde está inscripto (no de otro curso)", (await repo.findSinDictarByAlumnoId(m.hijo1)).map((c) => c.cursoId).sort().join(","), [m.cursoId, m.cursoId].sort().join(","));
    ok("las de un alumno de otro curso son las de su curso", (await repo.findSinDictarByAlumnoId(m.alumnoAjeno)).map((c) => c.cursoId).join(","), m.cursoMultiId);

    await prisma.asistencia.create({ data: { id: `${P}-as-sc`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: dia("2026-03-24"), estado: "presente" } });
    ok("cuenta las filas de asistencia de ese curso y día", `${await repo.contarRegistrosDelDia(m.cursoId, dia("2026-03-24"))} ${await repo.contarRegistrosDelDia(m.cursoId, dia("2026-03-26"))}`, "1 0");
    await prisma.$transaction(async (tx) => {
      await repo.bloquearClase(m.cursoId, dia("2026-03-24"), tx);
    });
    ok("tomar el bloqueo de la clase dentro de una transacción no falla", true, true);

    ok("borrar un curso que tiene marcas se rechaza", (await mensaje(() => prisma.curso.delete({ where: { id: m.cursoMultiId } }))) !== "no falló", true);
    await repo.eliminarClaseSinDictar(`${P}-sc-b`);
    ok("se borra una marca", (await repo.findClaseSinDictar(m.cursoId, dia("2026-03-19"))) === null, true);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
