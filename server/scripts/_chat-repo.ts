import { PrismaClient } from "@prisma/client";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const repo = new PrismaChatRepository(prisma);
let n = 0;
const mensaje = (chatId: string, rolEmisor: "padre" | "secretario", emisorId: string, fecha: string) =>
  prisma.mensaje.create({ data: { id: `${P}-m${++n}`, chatId, emisorId, rolEmisor, texto: `msg ${n}`, fecha: new Date(fecha) } });

(async () => {
  const m = await crearMundo(prisma);
  const chat = await prisma.chat.create({ data: { id: `${P}-chat1`, padreId: m.padreId, creadoEn: new Date("2026-10-01T10:00:00Z") } });
  const vacio = await prisma.chat.create({ data: { id: `${P}-chat2`, padreId: m.padreAjenoId, creadoEn: new Date("2026-10-02T10:00:00Z") } });

  // La migración dejó vistos los mensajes que ya existían
  ok("mensajes viejos sin ver", await prisma.mensaje.count({ where: { vistoEn: null, chat: { padreId: { not: { startsWith: P } } } } }), 0);

  const m1 = await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:00:00Z");
  await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:01:00Z");
  ok("el instituto tiene 2 sin ver", await repo.contarNoVistos(chat.id, "instituto"), 2);
  ok("la familia no tiene nada sin ver", await repo.contarNoVistos(chat.id, "familia"), 0);
  ok("conversaciones con algo sin ver", await repo.contarConversacionesConNoVistos(), 1);

  const resumenes = (await repo.findResumenes()).filter((r) => r.chatId.startsWith(P));
  ok("resumen: primero la que tiene mensajes", resumenes.map((r) => r.chatId).join(), `${P}-chat1,${P}-chat2`);
  ok("resumen: no leídos", resumenes[0].noLeidos, 2);
  ok("resumen: último mensaje", `${resumenes[0].ultimoMensaje?.texto} ${resumenes[0].ultimoMensaje?.delInstituto}`, "msg 2 false");
  ok("resumen: nombre del padre", resumenes[0].padreNombre, "Pruebaav padre");
  ok("resumen: hijos", resumenes[0].hijos.sort().join(" · "), "Lunaav Pruebaav · Tomasav Pruebaav");
  ok("resumen: la vacía sin último mensaje", resumenes[1].ultimoMensaje, null);

  const ahora = new Date("2026-10-10T10:05:00Z");
  ok("la familia lee: no marca los suyos", await repo.marcarVistos(chat.id, "familia", ahora), 0);
  // Solo los que estaban en pantalla (por id): el segundo llegó después
  ok("solo los que se vieron", await repo.marcarVistos(chat.id, "instituto", ahora, { ids: [m1.id] }), 1);
  ok("el instituto lee el resto", await repo.marcarVistos(chat.id, "instituto", ahora), 1);
  ok("ya no queda nada sin ver", await repo.contarNoVistos(chat.id, "instituto"), 0);
  ok("leer de nuevo no marca nada", await repo.marcarVistos(chat.id, "instituto", ahora), 0);
  await mensaje(chat.id, "secretario", m.admin, "2026-10-10T10:06:00Z");
  ok("la familia tiene 1 sin ver", await repo.contarNoVistos(chat.id, "familia"), 1);
  ok("los mensajes traen vistoEn", (await repo.findPaginaDeMensajes(chat.id, { limite: 50 })).at(-1)?.vistoEn?.toISOString(), ahora.toISOString());
  // Dos mensajes del mismo milisegundo: se marca solo el que estaba en pantalla
  const a = await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:06:30Z");
  const b = await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:06:30Z");
  ok("mismo milisegundo: solo el que se vio", await repo.marcarVistos(chat.id, "instituto", ahora, { ids: [a.id] }), 1);
  ok("el otro sigue sin ver", (await prisma.mensaje.findUnique({ where: { id: b.id } }))?.vistoEn, null);
  // Los anteriores a lo cargado en pantalla también quedan vistos (la conversación se abrió)
  ok("los anteriores a lo cargado", await repo.marcarVistos(chat.id, "instituto", ahora, { ids: [], antesDe: new Date("2026-10-10T10:06:45Z") }), 1);
  void vacio;

  // Criterios de los avisos (adelantados de la Task 3: el enum de la base ya tiene los dos tipos)
  await mensaje(chat.id, "padre", m.padre, "2026-10-10T10:07:00Z");
  const criterios = new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma));
  const clave = `mensajes:${chat.id}`;
  const alAdmin = (await criterios.esperados("mensajes_familia", ahora)).find((a) => a.usuarioId === m.admin && a.clave === clave);
  ok("aviso al instituto", `${alAdmin?.texto} · ${alAdmin?.nivel} · ${JSON.stringify(alAdmin?.recurso)}`, `1 mensaje nuevo de Pruebaav padre · 1 · {"tipo":"chat","chatId":"${chat.id}"}`);
  const alPadre = (await criterios.esperados("mensajes_instituto", ahora)).filter((a) => a.clave === clave);
  ok("aviso al padre, solo a él", alPadre.map((a) => `${a.usuarioId} ${a.rol} ${a.texto}`).join(), `${m.padre} padre 1 mensaje nuevo del instituto`);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
