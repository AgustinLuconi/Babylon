// Revisión única del descuento por hermanos de lo que ya está cargado.
//   pnpm exec tsx scripts/revisar-descuentos-hermanos.ts mostrar
//       Lista qué cambiaría. No modifica nada.
//   pnpm exec tsx scripts/revisar-descuentos-hermanos.ts aplicar --confirmo
//       Corrige la marca de cada alumno (y la de su inscripción del ciclo activo). No toca ninguna cuota ni genera avisos.
//       Correrlo solo con autorización de quien administra el sistema y con un respaldo previo (pg_dump -Fc en
//       ~/respaldos-babylon/).
import { PrismaClient } from "@prisma/client";
import { correccionesDeDescuento } from "../src/modules/alumnos/alumno.hermanos";

export interface CorreccionRevisada {
  alumnoId: string;
  nombre: string;
  de: boolean;
  a: boolean;
}

// Calcula las correcciones de todas las familias (agrupadas por responsable) y, si `aplicar`, las guarda. `prefijoDeId`
// limita la revisión a los alumnos cuyo id empieza así (las pruebas lo usan para no tocar nunca datos reales): aplicar
// sobre toda la base exige `sobreTodaLaBase: true` (lo pone el CLI con --confirmo). Al aplicar, todo corre en una
// transacción que primero bloquea las fichas (en orden de id, como el servicio) y recién después lee y escribe, así una
// baja que llegue en el medio no se pisa.
export async function revisar(
  prisma: PrismaClient,
  opciones: { aplicar: boolean; prefijoDeId?: string; sobreTodaLaBase?: boolean },
): Promise<CorreccionRevisada[]> {
  if (opciones.aplicar && !opciones.prefijoDeId && !opciones.sobreTodaLaBase) {
    throw new Error("Aplicar sobre toda la base necesita sobreTodaLaBase: true (o un prefijo de id).");
  }
  const filtro = { padreId: { not: null }, ...(opciones.prefijoDeId ? { id: { startsWith: opciones.prefijoDeId } } : {}) };
  const seleccion = { id: true, nombre: true, apellido: true, estado: true, fechaInscripcion: true, aplicaDescuentoHermanos: true, padreId: true } as const;

  const calcular = (alumnos: { id: string; nombre: string; apellido: string; estado: "activo" | "inactivo" | "egresado"; fechaInscripcion: Date; aplicaDescuentoHermanos: boolean; padreId: string | null }[]) => {
    const familias = new Map<string, typeof alumnos>();
    for (const a of alumnos) familias.set(a.padreId as string, [...(familias.get(a.padreId as string) ?? []), a]);
    const porId = new Map(alumnos.map((a) => [a.id, a]));
    const resultado: CorreccionRevisada[] = [];
    for (const hermanos of familias.values()) {
      for (const { alumnoId, aplica } of correccionesDeDescuento(hermanos)) {
        const a = porId.get(alumnoId)!;
        resultado.push({ alumnoId, nombre: `${a.nombre} ${a.apellido}`, de: a.aplicaDescuentoHermanos, a: aplica });
      }
    }
    return resultado;
  };

  if (!opciones.aplicar) {
    return calcular(await prisma.alumno.findMany({ where: filtro, select: seleccion, orderBy: { id: "asc" } }));
  }

  return prisma.$transaction(
    async (tx) => {
      const padreIds = [...new Set((await tx.alumno.findMany({ where: filtro, select: { padreId: true } })).map((a) => a.padreId as string))].sort();
      if (padreIds.length > 0) await tx.$queryRaw`SELECT id FROM "Padre" WHERE id = ANY(${padreIds}) ORDER BY id FOR UPDATE`;
      const resultado = calcular(await tx.alumno.findMany({ where: filtro, select: seleccion, orderBy: { id: "asc" } }));
      const ciclo = await tx.ciclo.findFirst({ where: { activo: true } });
      for (const c of resultado) {
        await tx.alumno.update({ where: { id: c.alumnoId }, data: { aplicaDescuentoHermanos: c.a } });
        if (ciclo) await tx.inscripcion.updateMany({ where: { alumnoId: c.alumnoId, cicloId: ciclo.id }, data: { aplicaDescuentoHermanos: c.a } });
      }
      return resultado;
    },
    { timeout: 60_000 },
  );
}

const texto = (c: CorreccionRevisada) => `${c.nombre}: pasa de ${c.de ? "10%" : "completo"} a ${c.a ? "10%" : "completo"}`;

if (require.main === module) {
  const [modo, ...resto] = process.argv.slice(2);
  const prisma = new PrismaClient();
  (async () => {
    if (modo !== "mostrar" && modo !== "aplicar") {
      console.error("Uso: revisar-descuentos-hermanos.ts mostrar | aplicar --confirmo");
      process.exitCode = 1;
      return;
    }
    if (modo === "aplicar" && !resto.includes("--confirmo")) {
      console.error("No se aplicó nada: `aplicar` necesita --confirmo (y la autorización de quien administra el sistema).");
      process.exitCode = 1;
      return;
    }
    const correcciones = await revisar(prisma, { aplicar: modo === "aplicar", sobreTodaLaBase: modo === "aplicar" });
    for (const c of correcciones) console.log(texto(c));
    console.log(`${correcciones.length} alumno(s) ${modo === "aplicar" ? "corregidos" : "cambiarían"}.`);
  })().finally(() => prisma.$disconnect());
}
