import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ChatService } from "../src/modules/chats/chat.service";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const anuncios: string[] = [];
let creadas = 0;
tablero.alPublicarse("chat.creada", async () => void creadas++);
tablero.alPublicarse("chat.mensaje", async (d) => void anuncios.push(`mensaje ${d.usuarioIdPadre}`));
tablero.alPublicarse("chat.leido", async (d) => void anuncios.push(`leido ${d.usuarioIdPadre}`));
const servicio = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, tablero);
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);

(async () => {
  const m = await crearMundo(prisma);
  const mio = await servicio.miConversacion(m.padreId);
  ok("el padre abre su conversación sin nada sin leer", mio.noLeidos, 0);

  anuncios.length = 0;
  await servicio.enviarMensaje(mio.id, "Hola", m.padre, "padre", m.padreId);
  ok("enviar anuncia con la cuenta del padre", anuncios.join(), `mensaje ${m.padre}`);
  ok("el instituto tiene una conversación sin leer", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":1}');

  anuncios.length = 0;
  await servicio.marcarLeido(mio.id, "instituto");
  ok("leer anuncia", anuncios.join(), `leido ${m.padre}`);
  anuncios.length = 0;
  await servicio.marcarLeido(mio.id, "instituto");
  ok("leer sin nada pendiente no anuncia", anuncios.length, 0);
  ok("ya no queda nada sin leer", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":0}');

  await servicio.enviarMensaje(mio.id, "Respuesta", m.admin, "secretario");
  ok("el padre tiene un mensaje sin leer", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":1}');
  ok("y lo ve en su conversación", (await servicio.miConversacion(m.padreId)).noLeidos, 1);
  ok("un padre no puede marcar otra conversación", await rechazo(servicio.marcarLeido(mio.id, "familia", m.padreAjenoId)), "AuthorizationError");
  await servicio.marcarLeido(mio.id, "familia", m.padreId);
  ok("el padre lee", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":0}');

  const iniciada = await servicio.iniciarConversacion(m.padreAjenoId);
  ok("iniciar: con cuenta activa", iniciada.estadoCuenta, "activa");
  const otraVez = await Promise.all([servicio.iniciarConversacion(m.padreAjenoId), servicio.iniciarConversacion(m.padreAjenoId)]);
  ok("iniciar dos veces a la vez: la misma conversación", otraVez.every((c) => c.id === iniciada.id) ? "sí" : "no", "sí");
  ok("una sola conversación por familia", await prisma.chat.count({ where: { padreId: m.padreAjenoId } }), 1);
  ok("iniciar con un padre inexistente", await rechazo(servicio.iniciarConversacion("no-existe")), "EntityNotFoundError");
  await prisma.padre.create({ data: { id: `${P}-sincuenta`, nombre: "Pruebaav", apellido: "Sincuenta", dni: "99400050" } });
  ok("iniciar con un padre sin cuenta", (await servicio.iniciarConversacion(`${P}-sincuenta`)).estadoCuenta, "sin-cuenta");
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "inactivo" } });
  ok("iniciar con la cuenta desactivada", (await servicio.iniciarConversacion(m.padreAjenoId)).estadoCuenta, "inactiva");
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "pendiente" } });
  ok("iniciar con la invitación pendiente", (await servicio.iniciarConversacion(m.padreAjenoId)).estadoCuenta, "pendiente");
  await prisma.usuario.update({ where: { id: m.ajeno }, data: { estado: "activo" } });
  ok("se anuncia cada conversación creada, una sola vez", creadas, 3);

  const resumen = (await servicio.listarResumenes()).find((r) => r.chatId === mio.id);
  ok("el resumen trae la última respuesta del instituto", `${resumen?.ultimoMensaje?.texto} ${resumen?.ultimoMensaje?.delInstituto}`, "Respuesta true");

  // Todo o nada: si guardar el aviso falla, el mensaje tampoco queda guardado
  const roto = new TableroDeAnuncios<EventosDelSistema>();
  roto.alPublicarse("chat.mensaje", async () => {
    throw new Error("falla simulada del aviso");
  });
  const conAvisoRoto = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), uow, roto);
  const antes = await prisma.mensaje.count({ where: { chatId: mio.id } });
  await conAvisoRoto.enviarMensaje(mio.id, "No debería quedar", m.padre, "padre", m.padreId).catch(() => {});
  ok("si el aviso falla, el mensaje no queda", await prisma.mensaje.count({ where: { chatId: mio.id } }), antes);

  // Mensajes por páginas: los últimos 50 y, a pedido, los anteriores (sin repetir ni saltear)
  const base = Date.parse("2026-10-01T10:00:00Z");
  await prisma.mensaje.createMany({
    data: Array.from({ length: 55 }, (_, i) => ({ id: `${P}-p${String(i).padStart(2, "0")}`, chatId: mio.id, emisorId: m.padre, rolEmisor: "padre" as const, texto: `pág ${i}`, fecha: new Date(base + i * 60000), vistoEn: new Date() })),
  });
  const total = await prisma.mensaje.count({ where: { chatId: mio.id } });
  const pagina1 = await servicio.listarMensajes(mio.id, m.padreId);
  ok("primera página: los últimos 50", pagina1.mensajes.length, 50);
  ok("en orden, el más reciente al final", pagina1.mensajes.at(-1)?.texto, "Respuesta");
  const pagina2 = await servicio.listarMensajes(mio.id, m.padreId, pagina1.anteriores ?? undefined);
  ok("la segunda página trae el resto", pagina2.mensajes.length, total - 50);
  ok("y no hay más", pagina2.anteriores, null);
  ok("sin repetir", new Set([...pagina1.mensajes, ...pagina2.mensajes].map((x) => x.id)).size, total);
  ok("una página inválida", await rechazo(servicio.listarMensajes(mio.id, m.padreId, "basura")), "ValidationError");

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { padreId: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
