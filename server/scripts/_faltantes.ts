import { PrismaClient } from "@prisma/client";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaDocumentoRepository(prisma);
const faltan = async (alumnoId: string) =>
  (await repo.findFaltantes()).find((f) => f.alumnoId === alumnoId)?.faltan.join(",") ?? "nada";

(async () => {
  const m = await crearMundo(prisma);
  ok("sin ningún documento le faltan los tres", await faltan(m.hijo1), "formulario_inscripcion,copia_dni,autorizacion_imagen");
  await prisma.documento.create({ data: { id: `${P}-d1`, alumnoId: m.hijo1, tipo: "formulario_inscripcion", estado: "cargado" } });
  await prisma.documento.create({ data: { id: `${P}-d2`, alumnoId: m.hijo1, tipo: "autorizacion_imagen", estado: "revocado" } });
  ok("formulario cargado, imagen revocada", await faltan(m.hijo1), "copia_dni,autorizacion_imagen");
  await prisma.documento.create({ data: { id: `${P}-d3`, alumnoId: m.hijo1, tipo: "copia_dni", estado: "pendiente" } });
  ok("una fila 'pendiente' sigue faltando", await faltan(m.hijo1), "copia_dni,autorizacion_imagen");
  await prisma.documento.update({ where: { id: `${P}-d3` }, data: { estado: "cargado" } });
  await prisma.documento.update({ where: { id: `${P}-d2` }, data: { estado: "autorizado" } });
  ok("con todo completo no aparece", await faltan(m.hijo1), "nada");
  const hijo2 = (await repo.findFaltantes()).find((f) => f.alumnoId === m.hijo2);
  ok("trae el padre", hijo2?.padreId, m.padreId);
  ok("trae el nombre", hijo2?.nombre, "Lunaav");
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "inactivo" } });
  ok("un alumno inactivo no debe documentación", await faltan(m.hijo2), "nada");
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "activo" } });
  const otroCiclo = await prisma.ciclo.findFirst({ where: { activo: false } });
  if (otroCiclo) {
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: otroCiclo.id } });
    ok("inscripto solo en otro ciclo no debe documentación", await faltan(m.hijo2), "nada");
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: m.cicloId } });
  }
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.alumno.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
