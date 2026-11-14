// Asistente "Pasar de año": vista previa sin escribir, confirmación todo o nada, repetible, con cierre opcional.
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { crearVerificadorDeCiclo } from "../src/modules/ciclos/ciclo.guarda";
import { PrismaCicloRepository } from "../src/modules/ciclos/ciclo.repository.prisma";
import { PaseDeAnioService } from "../src/modules/ciclos/paseDeAnio.service";
import { paseDeAnioSchema } from "../src/modules/ciclos/paseDeAnio.schema";
import { PrismaCursoRepository } from "../src/modules/cursos/curso.repository.prisma";
import { container } from "../src/container";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const servicio = container.paseDeAnioService;
const resultado = async (f: () => Promise<unknown>): Promise<string> => {
  try {
    await f();
    return "ok";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};
const entrada = (parcial: Record<string, unknown>) => paseDeAnioSchema.parse(parcial);
const cuenta = async () => ({
  cursos: await prisma.curso.count({ where: { profesorId: { startsWith: P } } }),
  inscripciones: await prisma.inscripcion.count({ where: { alumno: { id: { startsWith: P } } } }),
});

(async () => {
  const m = await crearMundo(prisma);
  const activoOriginal = m.cicloId;
  try {
    const [c98, c99, c2100] = [`${P}-ciclo-2098`, `${P}-ciclo-2099`, `${P}-ciclo-2100`];
    for (const [id, anio] of [[c98, 2098], [c99, 2099], [c2100, 2100]] as const) await prisma.ciclo.create({ data: { id, anio, activo: false } });
    const curso = (id: string, nombre: string, cicloId: string, cupo: number) =>
      prisma.curso.create({ data: { id: `${P}-${id}`, nombre, nivel: "kids", profesorId: m.profesorId, cicloId, aula: "A1", cupo, estado: "activo" } });
    await curso("c1", "Pruebaav A1 (Niños)", c98, 10);
    await curso("c2", "Pruebaav A2", c98, 12);
    await curso("d2", "pruebaav a2", c99, 7); // ya existe en el destino con el mismo nombre
    for (const [id, cursoId, dia] of [["h1", "c1", "lunes"], ["h2", "c1", "miercoles"], ["h3", "d2", "viernes"]] as const) {
      await prisma.horario.create({ data: { id: `${P}-${id}`, cursoId: `${P}-${cursoId}`, diaSemana: dia, horaInicio: "10:00", horaFin: "11:00" } });
    }
    const alumno = async (id: string, cursoId: string, padreId: string, estado: "activo" | "inactivo" = "activo") => {
      await prisma.alumno.create({
        data: { id: `${P}-${id}`, nombre: `Pruebaav${id}`, apellido: "Pruebaav", fechaInscripcion: new Date(), estado, padreId, cursoId: `${P}-${cursoId}`, aplicaDescuentoHermanos: false },
      });
      await prisma.inscripcion.create({ data: { id: `${P}-${id}-i98`, alumnoId: `${P}-${id}`, cursoId: `${P}-${cursoId}`, cicloId: c98, fecha: new Date(), aplicaDescuentoHermanos: false } });
    };
    await alumno("a1", "c1", m.padreAjenoId);
    await alumno("a2", "c1", m.padreAjenoId);
    await alumno("a3", "c2", m.padreAjenoId);
    await alumno("a4", "c2", m.padreAjenoId);
    await alumno("a5", "c1", m.padreAjenoId, "inactivo"); // no entra: no está activo
    await alumno("a6", "c1", m.padreAjenoId); // ya inscripto en el destino con otro curso
    await prisma.inscripcion.create({ data: { id: `${P}-a6-i99`, alumnoId: `${P}-a6`, cursoId: `${P}-d2`, cicloId: c99, fecha: new Date(), aplicaDescuentoHermanos: false } });

    const base = {
      origenId: c98,
      destino: { cicloId: c99 },
      copiarCursoIds: [`${P}-c1`, `${P}-c2`],
      cursos: [
        { cursoOrigenId: `${P}-c1`, destino: { tipo: "copia", copiaDe: `${P}-c1` }, excepciones: [{ alumnoId: `${P}-a2`, destino: { tipo: "no-continuan" } }] },
        { cursoOrigenId: `${P}-c2`, destino: { tipo: "copia", copiaDe: `${P}-c2` }, excepciones: [{ alumnoId: `${P}-a4`, destino: { tipo: "egresan" } }] },
      ],
    };

    // Vista previa: no escribe nada
    const antes = await cuenta();
    const previa = await servicio.vistaPrevia(entrada(base));
    ok("vista previa: no escribe cursos ni inscripciones", JSON.stringify(await cuenta()), JSON.stringify(antes));
    ok("vista previa: totales", JSON.stringify(previa.totales), JSON.stringify({ pasan: 2, egresan: 1, noContinuan: 1, cursosCopiados: 2 }));
    ok("vista previa: el ya inscripto se muestra", previa.yaInscriptos.map((y) => y.alumnoId).join(","), `${P}-a6`);
    ok("vista previa: el inactivo no entra", previa.origen.flatMap((c) => c.alumnos).some((a) => a.id === `${P}-a5`), false);
    ok("vista previa: avisa que el año del origen no terminó", previa.advertenciaAnioEnCurso, true);

    // Sin decisión para un curso con alumnos: se rechaza y no se escribe nada
    const sinDecision = entrada({ ...base, cursos: [base.cursos[0]] });
    ok("curso con alumnos sin decisión: 400", await resultado(() => servicio.confirmar(sinDecision)), "ValidationError");
    ok("y no se escribió nada", JSON.stringify(await cuenta()), JSON.stringify(antes));
    ok("origen igual a destino", await resultado(() => servicio.confirmar(entrada({ ...base, destino: { cicloId: c98 } }))), "ValidationError");

    // Confirmar
    const resumen = await servicio.confirmar(entrada(base));
    ok("confirmar: resumen", `${resumen.pasan}/${resumen.egresan}/${resumen.noContinuan}`, "2/1/1");
    const cursos99 = await prisma.curso.findMany({ where: { cicloId: c99 }, include: { horarios: true } });
    ok("destino: 2 cursos (uno copiado, uno reutilizado)", cursos99.length, 2);
    const copiado = cursos99.find((c) => c.nombre === "Pruebaav A1 (Niños)");
    ok("la copia lleva nombre, aula, cupo, profesor y estado", `${copiado?.aula}/${copiado?.cupo}/${copiado?.profesorId}/${copiado?.estado}`, `A1/10/${m.profesorId}/activo`);
    ok("la copia lleva los horarios", copiado?.horarios.length, 2);
    const reutilizado = cursos99.find((c) => c.id === `${P}-d2`);
    ok("el curso reutilizado no se pisa (cupo y horarios)", `${reutilizado?.cupo}/${reutilizado?.horarios.length}`, "7/1");
    const a1 = await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a1` }, include: { inscripciones: true } });
    ok("a1 pasa: curso actual nuevo", a1.cursoId, copiado?.id);
    ok("a1: inscripción nueva en el destino", a1.inscripciones.find((i) => i.cicloId === c99)?.cursoId, copiado?.id);
    ok("a1: la inscripción vieja queda intacta", a1.inscripciones.find((i) => i.cicloId === c98)?.cursoId, `${P}-c1`);
    ok("a3 pasa al curso reutilizado", (await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a3` } })).cursoId, `${P}-d2`);
    const a2 = await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a2` } });
    ok("a2 no continúa: inactivo y conserva su curso", `${a2.estado}/${a2.cursoId}`, `inactivo/${P}-c1`);
    const a4 = await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a4` } });
    ok("a4 egresa: egresado y conserva su curso", `${a4.estado}/${a4.cursoId}`, `egresado/${P}-c2`);
    ok("a6, ya inscripto, no se toca", (await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a6` } })).cursoId, `${P}-c1`);
    ok("a5, inactivo, no se toca", (await prisma.alumno.findUniqueOrThrow({ where: { id: `${P}-a5` } })).estado, "inactivo");
    ok("no se generaron avisos de descuento", await prisma.notificacion.count({ where: { tipo: { in: ["descuento_hermanos", "descuento_hermanos_instituto"] }, creadaEn: { gte: new Date(Date.now() - 60_000) } } }), 0);

    // Repetir no duplica nada
    const despues = await cuenta();
    const otra = await servicio.confirmar(entrada(base));
    ok("repetir: nadie pasa de nuevo", `${otra.pasan}/${otra.egresan}/${otra.noContinuan}`, "0/0/0");
    ok("repetir: no se duplican cursos ni inscripciones", JSON.stringify(await cuenta()), JSON.stringify(despues));

    // Ciclo destino nuevo (por año): se crea dentro de la misma transacción
    const nuevo = await servicio.confirmar(
      entrada({ origenId: c98, destino: { anio: 2097 }, copiarCursoIds: [`${P}-c1`], cursos: [{ cursoOrigenId: `${P}-c1`, destino: { tipo: "copia", copiaDe: `${P}-c1` } }, { cursoOrigenId: `${P}-c2`, destino: { tipo: "egresan" } }] }),
    );
    ok("destino por año: se creó el ciclo", await prisma.ciclo.count({ where: { anio: 2097 } }), 1);
    ok("destino por año: pasó a1", nuevo.pasan >= 1, true);

    // Del ciclo 2099 al 2100: todos los cursos de 2099 (la copia de A1 que dejó el primer pase y el que ya existía) se copian.
    const deNoventaYNueve = (extra: Record<string, unknown>) => ({
      origenId: c99,
      destino: { cicloId: c2100 },
      copiarCursoIds: [copiado?.id, `${P}-d2`],
      cursos: [
        { cursoOrigenId: copiado?.id, destino: { tipo: "copia", copiaDe: copiado?.id } },
        { cursoOrigenId: `${P}-d2`, destino: { tipo: "copia", copiaDe: `${P}-d2` } },
      ],
      ...extra,
    });

    // Todo o nada: si falla un anuncio al final, no queda nada escrito
    const tablero = new TableroDeAnuncios<EventosDelSistema>();
    tablero.alPublicarse("datos.cambiaron", async () => {
      throw new Error("falla forzada");
    });
    const cicloRepo = new PrismaCicloRepository(prisma);
    const cursoRepo = new PrismaCursoRepository(prisma);
    const fallido = new PaseDeAnioService(container.cicloService, cicloRepo, cursoRepo, new PrismaAlumnoRepository(prisma), container.alumnoService, new PrismaUnitOfWork(prisma), tablero, crearVerificadorDeCiclo(cicloRepo, cursoRepo));
    const antesDeFallar = await cuenta();
    ok(
      "falla a mitad: error",
      await resultado(() => fallido.confirmar(entrada(deNoventaYNueve({})))),
      "Error",
    );
    ok("falla a mitad: no queda nada escrito", JSON.stringify(await cuenta()), JSON.stringify(antesDeFallar));

    // Cierre: activa el destino y bloquea el origen (se restaura el ciclo activo real al terminar)
    const cierre = await servicio.confirmar(
      entrada(deNoventaYNueve({ cierre: { activarDestino: true, bloquearOrigen: true } })),
    );
    ok("cierre: el destino quedó activo", (await prisma.ciclo.findUniqueOrThrow({ where: { id: c2100 } })).activo, true);
    ok("cierre: el origen quedó bloqueado", (await prisma.ciclo.findUniqueOrThrow({ where: { id: c99 } })).bloqueado, true);
    ok("cierre: se copiaron los dos cursos", cierre.cursosCreados + cierre.cursosReutilizados, 2);
    ok("origen bloqueado: no se puede pasar de año desde él", await resultado(() => servicio.confirmar(entrada({ origenId: c99, destino: { cicloId: c98 }, copiarCursoIds: [], cursos: [] }))), "ConflictError");
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await prisma.ciclo.updateMany({ where: { activo: true }, data: { activo: false } });
    await prisma.ciclo.update({ where: { id: activoOriginal }, data: { activo: true } });
    await limpiarMundo(prisma);
    await prisma.ciclo.deleteMany({ where: { anio: 2097 } });
    await prisma.$disconnect();
    process.exit(0);
  }
})();
