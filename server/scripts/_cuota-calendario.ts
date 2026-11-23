// Las cuotas siguen el calendario del ciclo activo (meses con clases) y el día de vencimiento configurable.
// Toca el ciclo activo y la configuración de forma temporal: al terminar deja todo como estaba (valorCuota incluido).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { actualizarConfiguracionSchema } from "../src/modules/configuraciones/configuracion.schema";
import { ConfiguracionService } from "../src/modules/configuraciones/configuracion.service";
import { PrismaConfiguracionRepository } from "../src/modules/configuraciones/configuracion.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const configuracion = new ConfiguracionService(new PrismaConfiguracionRepository(prisma));
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const generar = (iso: string) => container.cuotaService.generarCuotasDelMes(new Date(`${iso}T15:00:00Z`));

(async () => {
  const m = await crearMundo(prisma);
  const cuotasAntes = new Set((await prisma.cuota.findMany({ select: { id: true } })).map((c) => c.id));
  const configAntes = await prisma.configuracion.findFirstOrThrow();
  const cuota = (mes: number) => prisma.cuota.findFirst({ where: { alumnoId: m.hijo1, mes, anio: 2026 } });
  try {
    await prisma.configuracion.update({ where: { id: configAntes.id }, data: { valorCuota: 1000, diaVencimiento: 10 } });

    // Meses con clases: julio con receso se cobra; un mes cubierto entero por una pausa, no; fuera del ciclo, no
    await prisma.pausaDelCiclo.create({ data: { id: `${P}-p-receso`, cicloId: m.cicloId, desde: dia("2026-07-20"), hasta: dia("2026-07-31"), nombre: "Receso", tipo: "receso" } });
    ok("julio con receso: se generan cuotas", (await generar("2026-07-15")) > 0, true);
    ok("julio con receso: el alumno tiene su cuota", Boolean(await cuota(7)), true);
    await prisma.pausaDelCiclo.create({ data: { id: `${P}-p-agosto`, cicloId: m.cicloId, desde: dia("2026-08-01"), hasta: dia("2026-08-31"), nombre: "Agosto cerrado", tipo: "otro" } });
    ok("agosto cubierto entero por una pausa: no se generan", await generar("2026-08-15"), 0);
    ok("agosto: el alumno no tiene cuota", Boolean(await cuota(8)), false);
    ok("enero (fuera del ciclo): no se generan", await generar("2026-01-15"), 0);
    ok("diciembre (fuera del ciclo): no se generan", await generar("2026-12-15"), 0);

    // Día de vencimiento configurable
    await prisma.configuracion.update({ where: { id: configAntes.id }, data: { diaVencimiento: 5 } });
    await generar("2026-04-02");
    ok("con día 5 la cuota de abril vence el 5/4", (await cuota(4))?.vencimiento.toISOString().slice(0, 10), "2026-04-05");
    await generar("2026-05-15");
    ok("generada después del día 5 de su propio mes: vence a fin de mes", (await cuota(5))?.vencimiento.toISOString().slice(0, 10), "2026-05-31");
    await prisma.configuracion.update({ where: { id: configAntes.id }, data: { diaVencimiento: 20 } });
    ok("una cuota ya generada no cambia su vencimiento", (await cuota(4))?.vencimiento.toISOString().slice(0, 10), "2026-04-05");

    // Validación y edición de la configuración
    const mensaje = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? "válido" : r.error?.issues[0].message);
    ok("día 0 se rechaza", mensaje(actualizarConfiguracionSchema.safeParse({ diaVencimiento: 0 })), "El día de vencimiento tiene que estar entre 1 y 28");
    ok("día 29 se rechaza", mensaje(actualizarConfiguracionSchema.safeParse({ diaVencimiento: 29 })), "El día de vencimiento tiene que estar entre 1 y 28");
    ok("día con decimales se rechaza", mensaje(actualizarConfiguracionSchema.safeParse({ diaVencimiento: 10.5 })), "El día de vencimiento tiene que estar entre 1 y 28");
    ok("un pedido vacío se rechaza", mensaje(actualizarConfiguracionSchema.safeParse({})), "No hay nada para guardar");
    ok("día 28 es válido", mensaje(actualizarConfiguracionSchema.safeParse({ diaVencimiento: 28 })), "válido");
    const guardada = await configuracion.actualizar(actualizarConfiguracionSchema.parse({ diaVencimiento: 7 }));
    ok("editar solo el día no pisa el valor de la cuota", `${guardada.valorCuota} ${guardada.diaVencimiento}`, "1000 7");
    const otra = await configuracion.actualizar(actualizarConfiguracionSchema.parse({ valorCuota: 1500 }));
    ok("editar solo el valor no pisa el día", `${otra.valorCuota} ${otra.diaVencimiento}`, "1500 7");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.pausaDelCiclo.deleteMany({ where: { id: { startsWith: P } } });
    await prisma.cuota.deleteMany({ where: { id: { notIn: [...cuotasAntes] } } });
    await prisma.configuracion.update({ where: { id: configAntes.id }, data: { valorCuota: configAntes.valorCuota, diaVencimiento: configAntes.diaVencimiento } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
