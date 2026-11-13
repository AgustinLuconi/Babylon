import { PrismaClient } from "@prisma/client";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import type { AvisoEsperado, TipoEstado } from "../src/modules/notificaciones/notificacion.entity";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const documentoRepo = new PrismaDocumentoRepository(prisma);
const criterios = new PrismaCriteriosDeAvisos(prisma, documentoRepo, new PrismaAlumnoRepository(prisma));
const JUEVES_15 = new Date("2026-10-15T18:00:00Z"); // jueves 15/10, 15:00 en Argentina
const JUEVES_15_TEMPRANO = new Date("2026-10-15T16:00:00Z"); // 13:00: la clase de las 14 todavía no empezó
const JUEVES_22 = new Date("2026-10-22T18:00:00Z");
const JUEVES_3_DIC = new Date("2026-12-03T18:00:00Z");
const fecha = (dia: string) => new Date(`${dia}T00:00:00Z`);
const de = (lista: AvisoEsperado[], usuarioId: string, rol?: string) =>
  lista.filter((a) => a.usuarioId === usuarioId && (!rol || a.rol === rol));
const claves = (lista: AvisoEsperado[]) => lista.map((a) => a.clave).sort().join(" ");
const esperados = (tipo: TipoEstado, ahora = JUEVES_15) => criterios.esperados(tipo, ahora);

(async () => {
  const m = await crearMundo(prisma);
  const cuota = (id: string, alumnoId: string, mes: number, vence: string, estado: "pendiente" | "vencida") =>
    prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId, mes, anio: 2026, montoBase: 10000, descuento: 0, montoFinal: 10000, vencimiento: fecha(vence), estado } });
  await cuota("c-oct-h1", m.hijo1, 10, "2026-10-18", "pendiente");
  await cuota("c-sep-h2", m.hijo2, 9, "2026-09-10", "vencida");
  await cuota("c-nov-h2", m.hijo2, 11, "2026-11-10", "pendiente");
  await cuota("c-sep-aj", m.alumnoAjeno, 9, "2026-09-10", "vencida");
  for (const tipo of ["formulario_inscripcion", "copia_dni"] as const) {
    await prisma.documento.create({ data: { id: `${P}-doc-${tipo}`, alumnoId: m.hijo1, tipo, estado: "cargado" } });
  }
  await prisma.documento.create({ data: { id: `${P}-doc-img`, alumnoId: m.hijo1, tipo: "autorizacion_imagen", estado: "autorizado" } });
  const evaluacion = (id: string, cursoId: string, nombre: string, dia: string, estado: "borrador" | "publicada") =>
    prisma.evaluacion.create({ data: { id: `${P}-${id}`, cursoId, nombre, tipo: "examen", fecha: fecha(dia), periodo: "noviembre", estado } });
  await evaluacion("e1", m.cursoId, "Unit 1", "2026-10-20", "borrador");
  await evaluacion("e2", m.cursoId, "Unit 2", "2026-10-30", "publicada");
  await evaluacion("e3", m.cursoMultiId, "Unit 3", "2026-10-16", "borrador");
  await prisma.calificacion.create({ data: { id: `${P}-cal1`, evaluacionId: `${P}-e1`, alumnoId: m.hijo1, nota: "8" } });
  await prisma.calificacion.create({ data: { id: `${P}-cal3`, evaluacionId: `${P}-e3`, alumnoId: m.alumnoAjeno, nota: "7" } });
  await prisma.notaCierre.create({ data: { id: `${P}-nc1`, alumnoId: m.hijo2, cursoId: m.cursoId, periodo: "julio", nota: "9", estado: "borrador" } });
  await prisma.asistencia.create({ data: { id: `${P}-as1`, alumnoId: m.hijo1, cursoId: m.cursoId, fecha: fecha("2026-10-13"), estado: "presente" } });

  // Cuotas del padre
  const cuotas = await esperados("cuota");
  const delPadre = de(cuotas, m.padre);
  ok("cuota: el padre tiene dos avisos", delPadre.length, 2);
  const porVencer = delPadre.find((a) => a.clave === `cuota:${P}-c-oct-h1`);
  ok("cuota por vencer: texto", porVencer?.texto, "La cuota de Octubre 2026 de Tomasav vence el 18/10");
  ok("cuota por vencer: amarilla", porVencer?.tono, "warning");
  ok("cuota por vencer: nivel", porVencer?.nivel, 1);
  ok("cuota por vencer: lleva al hijo", porVencer?.recurso.tipo === "cuota" && porVencer.recurso.alumnoId, m.hijo1);
  const vencida = delPadre.find((a) => a.clave === `cuota:${P}-c-sep-h2`);
  ok("cuota vencida: texto", vencida?.texto, "Cuota de Septiembre 2026 de Lunaav vencida — $10.000");
  ok("cuota vencida: roja y nivel 2", `${vencida?.tono} ${vencida?.nivel}`, "danger 2");
  ok("cuota a más de 5 días: sin aviso", delPadre.some((a) => a.clave === `cuota:${P}-c-nov-h2`) ? "sí" : "no", "no");
  ok("cuota: el ajeno solo ve la de su hijo", claves(de(cuotas, m.ajeno)), `cuota:${P}-c-sep-aj`);

  // Agrupados de administración y documentación
  const totalVencidas = await prisma.cuota.count({ where: { estado: "vencida" } });
  const vencidas = await esperados("cuotas_vencidas");
  const grupo = de(vencidas, m.admin);
  ok("cuotas vencidas: un aviso por cuenta", grupo.length, 1);
  ok("cuotas vencidas: el número es el total", grupo[0]?.nivel, totalVencidas);
  ok("cuotas vencidas: texto", grupo[0]?.texto, `Hay ${totalVencidas} cuotas vencidas`);
  ok("cuotas vencidas: multi como admin", de(vencidas, m.multi, "admin").length, 1);
  ok("cuotas vencidas: multi como profesor no", de(vencidas, m.multi, "profesor").length, 0);
  ok("cuotas vencidas: el padre no", de(vencidas, m.padre).length, 0);
  const totalFaltantes = (await documentoRepo.findFaltantes()).length;
  ok("documentación pendiente: el número coincide con faltantes", de(await esperados("documentacion_pendiente"), m.admin)[0]?.nivel, totalFaltantes);
  const docsHijos = await esperados("documentacion_hijo");
  ok("documentación del hijo: solo el que debe", claves(de(docsHijos, m.padre)), `documentacion:${m.hijo2}`);
  ok("documentación del hijo: el ajeno la del suyo", claves(de(docsHijos, m.ajeno)), `documentacion:${m.alumnoAjeno}`);

  // Evaluaciones y notas de cierre
  const proximas = de(await esperados("evaluacion_proxima"), m.admin);
  ok("evaluación próxima: dentro de 7 días", claves(proximas), `evaluacion-proxima:${P}-e1 evaluacion-proxima:${P}-e3`);
  ok("evaluación próxima: texto", proximas.find((a) => a.clave.endsWith("-e1"))?.texto, "Evaluación próxima: Unit 1 — Pruebaav Kids (20/10)");
  const sinPublicar = await esperados("notas_sin_publicar");
  ok("notas sin publicar: el profe la suya", claves(de(sinPublicar, m.profe)), `notas-sin-publicar:${P}-e1`);
  ok("notas sin publicar: multi como profesor la suya", claves(de(sinPublicar, m.multi, "profesor")), `notas-sin-publicar:${P}-e3`);
  ok("notas sin publicar: multi como admin nada", de(sinPublicar, m.multi, "admin").length, 0);
  const cierre = de(await esperados("cierre_sin_publicar"), m.profe);
  ok("cierre sin publicar: clave", claves(cierre), `cierre-sin-publicar:${m.cursoId}:julio`);
  ok("cierre sin publicar: texto", cierre[0]?.texto, "Notas de cierre de Pruebaav Kids (1° Cierre) en borrador");

  // Asistencia: clases martes y jueves 14:00; la del martes 13 ya se tomó
  const hoy = de(await esperados("asistencia_pendiente"), m.profe);
  ok("asistencia: el jueves ya empezado", claves(hoy), `asistencia:${m.cursoId}:2026-10-15`);
  ok("asistencia: texto de hoy", hoy[0]?.texto, "Falta tomar asistencia de Pruebaav Kids (hoy 14:00)");
  ok("asistencia: antes de que empiece la clase", de(await esperados("asistencia_pendiente", JUEVES_15_TEMPRANO), m.profe).length, 0);
  const semanaSiguiente = de(await esperados("asistencia_pendiente", JUEVES_22), m.profe);
  ok("asistencia: a los 7 días deja de figurar", claves(semanaSiguiente), `asistencia:${m.cursoId}:2026-10-20 asistencia:${m.cursoId}:2026-10-22`);
  ok("asistencia: texto de otro día", semanaSiguiente.find((a) => a.clave.endsWith("10-20"))?.texto, "Falta tomar asistencia de Pruebaav Kids del 20/10");
  ok("asistencia: en diciembre no hay clases", de(await esperados("asistencia_pendiente", JUEVES_3_DIC), m.profe).length, 0);

  // Las cuentas que no pueden entrar no reciben avisos
  for (const estado of ["inactivo"] as const) {
    await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado } });
    ok(`cuenta ${estado}: sin avisos`, de(await esperados("cuota"), m.ajeno).length, 0);
  }
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });

  // Eventos
  ok("nota: en borrador no avisa", (await criterios.notasPublicadas(`${P}-e1`, null)).length, 0);
  await prisma.evaluacion.update({ where: { id: `${P}-e1` }, data: { estado: "publicada", publicadaEn: new Date() } });
  const notas = await criterios.notasPublicadas(`${P}-e1`, null);
  ok("nota publicada: al padre del alumno", notas.map((a) => `${a.usuarioId}|${a.clave}`).join(), `${m.padre}|nota:${P}-e1:${m.hijo1}`);
  ok("nota publicada: texto", notas[0]?.texto, "Nueva nota de Tomasav: Unit 1");
  ok("nota publicada: solo los alumnos pedidos", (await criterios.notasPublicadas(`${P}-e1`, [m.hijo2])).length, 0);
  const publicadaEn = new Date("2026-10-15T17:00:00Z");
  await prisma.notaCierre.update({ where: { id: `${P}-nc1` }, data: { estado: "publicada", publicadaEn } });
  const cierres = await criterios.cierrePublicado(`${P}-nc1`);
  ok("cierre publicado: la clave lleva el momento", cierres[0]?.clave, `cierre:${P}-nc1:${publicadaEn.getTime()}`);
  ok("cierre publicado: texto", cierres[0]?.texto, "Nota de cierre (1° Cierre) de Lunaav publicada");
  const obs = await prisma.observacion.create({
    data: { id: `${P}-obs1`, alumnoId: m.hijo1, emisorId: m.profe, emisorRol: "profesor", fecha: new Date(), texto: "x", categoria: "academico" },
  });
  const observaciones = await criterios.observacionNueva(obs.id);
  ok("observación: al padre", `${observaciones[0]?.usuarioId} ${observaciones[0]?.texto}`, `${m.padre} Nueva observación sobre Tomasav`);
  await prisma.alumno.update({ where: { id: m.hijo1 }, data: { estado: "inactivo" } });
  ok("observación de un alumno inactivo: sin aviso", (await criterios.observacionNueva(obs.id)).length, 0);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
