// Aviso de estado "ciclo_por_cerrar" (solo administradores): desde el 1 de diciembre del año del ciclo activo, mientras
// ese ciclo siga activo y sin bloquear. Solo lee criterios: no escribe avisos en la base.
import { PrismaClient } from "@prisma/client";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { tipoNotificacionSchema } from "../src/modules/notificaciones/notificacion.schema";
import { tiposDelRol } from "../src/modules/notificaciones/notificacion.tipos";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const criterios = new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma));

(async () => {
  const m = await crearMundo(prisma);
  const activoOriginal = m.cicloId;
  try {
    const activo = await prisma.ciclo.findUniqueOrThrow({ where: { id: m.cicloId } });
    const anio = activo.anio;
    const propios = async (ahora: Date) => (await criterios.esperados("ciclo_por_cerrar", ahora)).filter((a) => a.usuarioId.startsWith(P));

    const antes = await propios(new Date(`${anio}-11-30T15:00:00Z`));
    ok("30/11: todavía no hay aviso", antes.length, 0);
    ok("30/11 a las 23:00 en Argentina: todavía no", (await propios(new Date(`${anio}-12-01T02:00:00Z`))).length, 0);
    const desde = await propios(new Date(`${anio}-12-01T03:00:00Z`));
    ok("1/12 a las 00:00 en Argentina: hay aviso para cada cuenta de administrador", desde.map((a) => a.usuarioId).sort().join(","), [m.admin, m.multi].sort().join(","));
    ok("solo con rol admin (la cuenta con dos roles lo recibe una vez)", desde.every((a) => a.rol === "admin"), true);
    ok("la secretaria no lo recibe", desde.some((a) => a.usuarioId === m.secre), false);
    const a = desde[0];
    ok("texto", a.texto, `El ciclo ${anio} terminó. Falta pasar de año: pasá a los alumnos y activá el ciclo nuevo.`);
    ok("clave con el ciclo", a.clave, `ciclo-por-cerrar:${m.cicloId}`);
    ok("tono, nivel y recurso", `${a.tono}/${a.nivel}/${JSON.stringify(a.recurso)}`, `warning/0/${JSON.stringify({ tipo: "pase-de-anio", cicloId: m.cicloId })}`);
    ok("un año después también sigue pendiente", (await propios(new Date(`${anio + 1}-02-10T15:00:00Z`))).length, 2);

    // Con el ciclo activo bloqueado (forzado solo en esta prueba) no hay aviso
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: true } });
    ok("ciclo activo bloqueado: sin aviso", (await propios(new Date(`${anio}-12-05T15:00:00Z`))).length, 0);
    await prisma.ciclo.update({ where: { id: m.cicloId }, data: { bloqueado: false } });

    // Al activar otro ciclo, el aviso deja de corresponder
    await prisma.ciclo.create({ data: { id: `${P}-ciclo-2099`, anio: 2099, activo: false } });
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: `${P}-ciclo-2099` }, data: { activo: true } });
    ok("otro ciclo activo (todavía no terminó): sin aviso", (await propios(new Date(`${anio}-12-05T15:00:00Z`))).length, 0);

    // Preferencias: solo el administrador lo ve en sus tipos; el catálogo completo es válido para el PATCH
    ok("el administrador lo tiene entre sus tipos", tiposDelRol("admin").includes("ciclo_por_cerrar"), true);
    ok("secretaría no lo tiene", tiposDelRol("secretario").includes("ciclo_por_cerrar"), false);
    ok("el profesor y el padre tampoco", tiposDelRol("profesor").includes("ciclo_por_cerrar") || tiposDelRol("padre").includes("ciclo_por_cerrar"), false);
    for (const tipo of ["ciclo_por_cerrar", "descuento_hermanos", "descuento_hermanos_instituto"]) {
      ok(`el pedido de preferencias acepta ${tipo}`, tipoNotificacionSchema.safeParse(tipo).success, true);
    }
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: activoOriginal }, data: { activo: true, bloqueado: false } });
    await limpiarMundo(prisma);
    await prisma.$disconnect();
  }
})();
