import { PrismaClient } from "@prisma/client";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { CanalEnVivo } from "../src/core/ports";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ChatService } from "../src/modules/chats/chat.service";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";
import { PrismaNotificacionRepository } from "../src/modules/notificaciones/notificacion.repository.prisma";
import { NotificacionService } from "../src/modules/notificaciones/notificacion.service";
import { suscribirAvisos } from "../src/modules/notificaciones/notificacion.suscripciones";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const canal: CanalEnVivo = { registrar: () => () => {}, enviarA: () => {}, enviarARoles: () => {}, conectado: () => false, revisarSesiones: async () => {} };
const avisos = new NotificacionService(new PrismaNotificacionRepository(prisma), new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), new PrismaAlumnoRepository(prisma)), canal, uow);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
suscribirAvisos(tablero, avisos);
const chats = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, tablero);
const aviso = (usuarioId: string, rol: string, clave: string) => prisma.notificacion.findFirst({ where: { usuarioId, rol: rol as never, clave } });

(async () => {
  const m = await crearMundo(prisma);
  const chat = await chats.miConversacion(m.padreId);
  const clave = `mensajes:${chat.id}`;

  await chats.enviarMensaje(chat.id, "Hola", m.padre, "padre", m.padreId);
  await chats.enviarMensaje(chat.id, "¿Mañana hay clase?", m.padre, "padre", m.padreId);
  const delAdmin = await aviso(m.admin, "admin", clave);
  ok("al instituto le llega el aviso agrupado", delAdmin?.texto, "2 mensajes nuevos de Pruebaav padre");
  ok("con el nivel", delAdmin?.nivel, 2);
  ok("lleva a la conversación", JSON.stringify(delAdmin?.recurso), JSON.stringify({ tipo: "chat", chatId: chat.id }));
  ok("también a la otra cuenta de administración", (await aviso(m.multi, "admin", clave)) ? "sí" : "no", "sí");
  ok("a quien escribió no le llega", (await aviso(m.padre, "padre", clave)) ? "sí" : "no", "no");

  await prisma.notificacion.updateMany({ where: { clave, usuarioId: m.admin }, data: { leidaEn: new Date() } });
  await chats.enviarMensaje(chat.id, "¿Me responden?", m.padre, "padre", m.padreId);
  const masAdmin = await aviso(m.admin, "admin", clave);
  ok("llega otro: el número sube", masAdmin?.texto, "3 mensajes nuevos de Pruebaav padre");
  ok("y vuelve a no leído", masAdmin?.leidaEn, null);

  await chats.marcarLeido(chat.id, "instituto");
  ok("leída por el instituto: se resuelve para el admin", (await aviso(m.admin, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");
  ok("y para la otra cuenta (bandeja compartida)", (await aviso(m.multi, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");

  await chats.enviarMensaje(chat.id, "Sí, normal", m.admin, "secretario");
  ok("al padre le llega el aviso", (await aviso(m.padre, "padre", clave))?.texto, "1 mensaje nuevo del instituto");
  ok("al instituto no le llega su propio mensaje", (await aviso(m.admin, "admin", clave))?.resueltaEn !== null ? "sí" : "no", "sí");
  await chats.marcarLeido(chat.id, "familia", m.padreId);
  ok("el padre lee: se resuelve", (await aviso(m.padre, "padre", clave))?.resueltaEn !== null ? "sí" : "no", "sí");

  // Un padre sin cuenta activa no recibe avisos; al activarla, aparece lo que ya le escribieron
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "pendiente" } });
  const delAjeno = await chats.iniciarConversacion(m.padreAjenoId);
  await chats.enviarMensaje(delAjeno.id, "Le escribimos por la cuota", m.admin, "secretario");
  ok("sin cuenta activa: sin aviso", (await aviso(m.ajeno, "padre", `mensajes:${delAjeno.id}`)) ? "sí" : "no", "no");
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });
  await uow.runInTransaction((tx) => tablero.publicar("cuenta.cambio", { usuarioId: m.ajeno }, tx));
  ok("al activarla: aparece el aviso", (await aviso(m.ajeno, "padre", `mensajes:${delAjeno.id}`))?.texto, "1 mensaje nuevo del instituto");

  await limpiarMundo(prisma);
  await avisos.sincronizarTodo();
  ok("limpieza", await prisma.notificacion.count({ where: { usuarioId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
