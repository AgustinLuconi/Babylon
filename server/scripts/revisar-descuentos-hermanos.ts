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
// limita la revisión a los alumnos cuyo id empieza así (las pruebas lo usan para no tocar nunca datos reales).
export async function revisar(
  prisma: PrismaClient,
  opciones: { aplicar: boolean; prefijoDeId?: string },
): Promise<CorreccionRevisada[]> {
  const alumnos = await prisma.alumno.findMany({
    where: { padreId: { not: null }, ...(opciones.prefijoDeId ? { id: { startsWith: opciones.prefijoDeId } } : {}) },
    select: { id: true, nombre: true, apellido: true, estado: true, fechaInscripcion: true, aplicaDescuentoHermanos: true, padreId: true },
    orderBy: { id: "asc" },
  });
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

  if (opciones.aplicar && resultado.length > 0) {
    const ciclo = await prisma.ciclo.findFirst({ where: { activo: true } });
    await prisma.$transaction(async (tx) => {
      for (const c of resultado) {
        await tx.alumno.update({ where: { id: c.alumnoId }, data: { aplicaDescuentoHermanos: c.a } });
        if (ciclo) await tx.inscripcion.updateMany({ where: { alumnoId: c.alumnoId, cicloId: ciclo.id }, data: { aplicaDescuentoHermanos: c.a } });
      }
    });
  }
  return resultado;
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
    const correcciones = await revisar(prisma, { aplicar: modo === "aplicar" });
    for (const c of correcciones) console.log(texto(c));
    console.log(`${correcciones.length} alumno(s) ${modo === "aplicar" ? "corregidos" : "cambiarían"}.`);
  })().finally(() => prisma.$disconnect());
}
