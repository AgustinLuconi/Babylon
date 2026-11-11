// Editar y borrar mensajes del chat: quién puede, el plazo de 15 minutos, "(editado)", el borrado que deja el aviso, y que
// un mensaje borrado ya no cuenta como "sin leer". Mundo de prueba (prefijo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { EventosDelSistema } from "../src/eventos";
import { PrismaChatRepository } from "../src/modules/chats/chat.repository.prisma";
import { ChatService } from "../src/modules/chats/chat.service";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { ok } from "./_check";
import { crearMundo, limpiarMundo } from "./_mundo-avisos";

const prisma = new PrismaClient();
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const anuncios: string[] = [];
tablero.alPublicarse("chat.editado", async (d) => void anuncios.push(`editado ${d.usuarioIdPadre}`));
tablero.alPublicarse("chat.eliminado", async (d) => void anuncios.push(`eliminado ${d.usuarioIdPadre}`));
const servicio = new ChatService(new PrismaChatRepository(prisma), new PrismaUsuarioRepository(prisma), new PrismaPadreRepository(prisma), new PrismaUnitOfWork(prisma), tablero);
const rechazo = (p: Promise<unknown>) => p.then(() => "ok", (e: Error) => e.name);
const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000);

(async () => {
  const m = await crearMundo(prisma);
  const chat = await servicio.miConversacion(m.padreId);
  const deFamilia = await servicio.enviarMensaje(chat.id, "Holaa", m.padre, "padre", m.padreId);
  const delInstituto = await servicio.enviarMensaje(chat.id, "Buen dia", m.admin, "secretario");
  const mensaje = (id: string) => prisma.mensaje.findUniqueOrThrow({ where: { id } });

  // Quién puede.
  ok("la familia corrige lo suyo", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "Hola", "padre", m.padreId)), "ok");
  const editado = await mensaje(deFamilia.id);
  ok("queda el texto nuevo y la marca de editado", `${editado.texto} ${editado.editadoEn !== null}`, "Hola true");
  ok("la fecha de envío no cambia", editado.fecha.getTime(), deFamilia.fecha.getTime());
  ok("la familia no corrige lo del instituto", await rechazo(servicio.editarMensaje(chat.id, delInstituto.id, "x", "padre", m.padreId)), "AuthorizationError");
  ok("el instituto no corrige lo de la familia", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "x", "admin")), "AuthorizationError");
  ok("cualquiera del instituto corrige lo del instituto (otro rol)", await rechazo(servicio.editarMensaje(chat.id, delInstituto.id, "Buen día", "admin")), "ok");
  ok("otra familia no toca la conversación", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "x", "padre", m.padreAjenoId)), "AuthorizationError");
  ok("un mensaje que no es de esa conversación", await rechazo(servicio.editarMensaje(chat.id, "no-existe", "x", "padre", m.padreId)), "EntityNotFoundError");

  // Sin cambios: no marca ni anuncia.
  anuncios.length = 0;
  const antes = (await mensaje(deFamilia.id)).editadoEn;
  await servicio.editarMensaje(chat.id, deFamilia.id, "Hola", "padre", m.padreId);
  ok("el mismo texto no anuncia", anuncios.length, 0);
  ok("el mismo texto no vuelve a marcar", (await mensaje(deFamilia.id)).editadoEn?.getTime(), antes?.getTime());
  await servicio.editarMensaje(chat.id, deFamilia.id, "Hola otra vez", "padre", m.padreId);
  ok("una corrección anuncia con la cuenta del padre", anuncios.join(), `editado ${m.padre}`);

  // El plazo cuenta desde el envío y no se renueva al corregir.
  await prisma.mensaje.update({ where: { id: deFamilia.id }, data: { fecha: hace(14) } });
  ok("a los 14 minutos todavía se puede", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "Hola 14", "padre", m.padreId)), "ok");
  await prisma.mensaje.update({ where: { id: deFamilia.id }, data: { fecha: hace(16) } });
  ok("a los 16 minutos no se puede corregir", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "Hola 16", "padre", m.padreId)), "ConflictError");
  ok("ni borrar", await rechazo(servicio.eliminarMensaje(chat.id, deFamilia.id, "padre", m.padreId)), "ConflictError");
  ok("el texto quedó como estaba", (await mensaje(deFamilia.id)).texto, "Hola 14");

  // Borrar: queda el aviso, el texto se borra de verdad y deja de contar como sin leer.
  await prisma.mensaje.update({ where: { id: deFamilia.id }, data: { fecha: hace(1) } });
  ok("el instituto tiene algo sin leer de la familia", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":1}');
  anuncios.length = 0;
  await servicio.eliminarMensaje(chat.id, deFamilia.id, "padre", m.padreId);
  const borrado = await mensaje(deFamilia.id);
  ok("borrar anuncia", anuncios.join(), `eliminado ${m.padre}`);
  ok("el texto original ya no está en la base", `"${borrado.texto}" ${borrado.eliminadoEn !== null}`, `"" true`);
  ok("un mensaje borrado no cuenta como sin leer", JSON.stringify(await servicio.noLeidos("instituto")), '{"conversaciones":0}');
  ok("la lista tampoco lo cuenta", (await servicio.listarResumenes()).find((r) => r.chatId === chat.id)?.noLeidos, 0);
  anuncios.length = 0;
  ok("borrar de nuevo no hace nada", await rechazo(servicio.eliminarMensaje(chat.id, deFamilia.id, "padre", m.padreId)), "ok");
  ok("y no anuncia", anuncios.length, 0);
  ok("un mensaje borrado no se corrige", await rechazo(servicio.editarMensaje(chat.id, deFamilia.id, "x", "padre", m.padreId)), "ConflictError");

  // El último de la conversación borrado figura así en la lista, y en la página del chat viene sin texto.
  await servicio.eliminarMensaje(chat.id, delInstituto.id, "secretario");
  const resumen = (await servicio.listarResumenes()).find((r) => r.chatId === chat.id);
  ok("la lista marca el último como eliminado", `${resumen?.ultimoMensaje?.eliminado} "${resumen?.ultimoMensaje?.texto}"`, `true ""`);
  const pagina = await servicio.listarMensajes(chat.id, m.padreId);
  ok("el chat devuelve los borrados sin texto y marcados", pagina.mensajes.map((x) => `${x.eliminadoEn !== null}/${x.texto}`).join("|"), "true/|true/");

  // Un mensaje del instituto sin ver que se borra deja de contar para la familia.
  const otro = await servicio.enviarMensaje(chat.id, "Recordatorio", m.admin, "admin");
  ok("la familia tiene uno sin leer", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":1}');
  await servicio.eliminarMensaje(chat.id, otro.id, "secretario");
  ok("borrado, ya no", JSON.stringify(await servicio.noLeidos("familia", m.padreId)), '{"mensajes":0}');
  ok("tampoco en su conversación", (await servicio.miConversacion(m.padreId)).noLeidos, 0);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
