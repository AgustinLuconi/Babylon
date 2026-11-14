// Revisión única del descuento por hermanos: `mostrar` no modifica nada; `aplicar` corrige solo las marcas (nunca cuotas
// ni avisos). Acá solo se prueba sobre datos prueba-tmp-av (prefijo): jamás se aplica sobre la base real.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";
import { revisar } from "./revisar-descuentos-hermanos";

const prisma = new PrismaClient();

(async () => {
  const m = await crearMundo(prisma);
  const reales = () => prisma.alumno.findMany({ where: { NOT: { id: { startsWith: P } } }, select: { id: true, aplicaDescuentoHermanos: true }, orderBy: { id: "asc" } });
  const marcasReales = JSON.stringify(await reales());

  // hijo1 (el primero por id, misma fecha) con descuento de más; hijo2 sin el que le corresponde; el hijo ajeno, solo.
  await prisma.alumno.update({ where: { id: m.hijo1 }, data: { aplicaDescuentoHermanos: true } });
  await prisma.inscripcion.updateMany({ where: { alumnoId: m.hijo1 }, data: { aplicaDescuentoHermanos: true } });
  await prisma.cuota.create({ data: { id: `${P}-cuota-rev`, alumnoId: m.hijo2, mes: 3, anio: 2099, montoBase: 10000, descuento: 0, montoFinal: 10000, vencimiento: new Date("2099-03-10T00:00:00Z"), estado: "pendiente" } });
  const cuotasAntes = JSON.stringify(await prisma.cuota.findMany({ where: { id: { startsWith: P } } }));
  const avisosAntes = await prisma.notificacion.count();

  const lista = await revisar(prisma, { aplicar: false, prefijoDeId: P });
  ok("mostrar: dos correcciones", lista.length, 2);
  ok("mostrar: hijo1 pasa de 10% a completo", JSON.stringify(lista.find((c) => c.alumnoId === m.hijo1)), JSON.stringify({ alumnoId: m.hijo1, nombre: "Tomasav Pruebaav", de: true, a: false }));
  ok("mostrar: hijo2 pasa de completo a 10%", lista.find((c) => c.alumnoId === m.hijo2)?.a, true);
  ok("mostrar no cambia nada", `${(await prisma.alumno.findUniqueOrThrow({ where: { id: m.hijo1 } })).aplicaDescuentoHermanos} ${(await prisma.alumno.findUniqueOrThrow({ where: { id: m.hijo2 } })).aplicaDescuentoHermanos}`, "true false");

  await revisar(prisma, { aplicar: true, prefijoDeId: P });
  const marca = async (id: string) => (await prisma.alumno.findUniqueOrThrow({ where: { id } })).aplicaDescuentoHermanos;
  const inscripcion = async (id: string) => (await prisma.inscripcion.findFirst({ where: { alumnoId: id } }))?.aplicaDescuentoHermanos;
  ok("aplicar: marcas correctas", `${await marca(m.hijo1)} ${await marca(m.hijo2)}`, "false true");
  ok("aplicar: la inscripción del ciclo acompaña", `${await inscripcion(m.hijo1)} ${await inscripcion(m.hijo2)}`, "false true");
  ok("aplicar: las cuotas no cambian", JSON.stringify(await prisma.cuota.findMany({ where: { id: { startsWith: P } } })) === cuotasAntes ? "iguales" : "cambiaron", "iguales");
  ok("aplicar: no crea avisos", (await prisma.notificacion.count()) - avisosAntes, 0);
  ok("aplicar: los alumnos reales no cambian", JSON.stringify(await reales()) === marcasReales ? "iguales" : "cambiaron", "iguales");
  ok("una segunda revisión ya no encuentra nada", (await revisar(prisma, { aplicar: false, prefijoDeId: P })).length, 0);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
