import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import { sinAnuncios } from "../../core/eventos";
import type { Publicador, UnitOfWork } from "../../core/ports";
import type { PadreRepository } from "../padres/padre.repository";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Chat, ResumenChat } from "./chat.entity";
import type { EventosChats } from "./chat.eventos";
import type { ChatRepository } from "./chat.repository";
import { MINUTOS_PARA_CORREGIR, type AlcanceLectura, type Lector, type Mensaje, type RolEmisorMensaje } from "./mensaje.entity";

export interface MensajeConEmisor extends Mensaje {
  emisorNombre: string;
}

// Una página de la conversación (el más reciente al final) y el marcador para pedir la anterior (null = no hay más).
export interface MensajesPaginados {
  mensajes: MensajeConEmisor[];
  anteriores: string | null;
}

// Si el padre puede leer la conversación: con cuenta activa sí; sin cuenta, cuando el administrador se la cree;
// con la cuenta desactivada, no puede entrar al sistema hasta que se reactive.
export type EstadoCuentaPadre = "activa" | "inactiva" | "sin-cuenta";

const MENSAJES_POR_PAGINA = 50;

// Marcador de página: fecha e id del mensaje más viejo mostrado ("2026-10-16T12:00:00.000Z|<id>").
const marcador = (m: Mensaje) => `${m.fecha.toISOString()}|${m.id}`;
function leerMarcador(texto: string): { fecha: Date; id: string } {
  const [iso, id] = texto.split("|");
  const fecha = new Date(iso ?? "");
  if (!id || Number.isNaN(fecha.getTime())) throw new ValidationError("La página pedida no es válida");
  return { fecha, id };
}

// Un chat por familia, con el instituto. La bandeja del instituto es compartida: lo que lee cualquier cuenta de
// administración o secretaría queda leído para todos. Enviar y leer anuncian el cambio dentro de la transacción (los
// avisos se guardan con la operación y la señal en vivo sale al confirmar).
export class ChatService {
  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly usuarioRepo: UsuarioRepository,
    private readonly padreRepo: PadreRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosChats> = sinAnuncios(),
  ) {}

  async listarResumenes(): Promise<ResumenChat[]> {
    return this.chatRepo.findResumenes();
  }

  // El padre abre su conversación (se crea la primera vez), con cuántos mensajes del instituto no vio.
  async miConversacion(padreId: string): Promise<Chat & { noLeidos: number }> {
    const chat = await this.obtenerOCrear(padreId);
    return { ...chat, noLeidos: await this.chatRepo.contarNoVistos(chat.id, "familia") };
  }

  // El instituto abre (o crea) la conversación con una familia. `estadoCuenta` dice si el padre ya puede leerla.
  async iniciarConversacion(padreId: string): Promise<Chat & { estadoCuenta: EstadoCuentaPadre }> {
    const padre = await this.padreRepo.findById(padreId);
    if (!padre) {
      throw new EntityNotFoundError("Padre", padreId);
    }
    const chat = await this.obtenerOCrear(padreId);
    const cuenta = padre.usuarioId ? await this.usuarioRepo.findById(padre.usuarioId) : null;
    const estadoCuenta: EstadoCuentaPadre = !cuenta ? "sin-cuenta" : cuenta.estado === "activo" ? "activa" : "inactiva";
    return { ...chat, estadoCuenta };
  }

  // Devuelve cada mensaje con el nombre de quien lo escribió (no solo su rol),
  // para mostrarle al padre "Secretaría — Lucía Peralta" en vez de un rol pelado.
  // De a una página: los últimos 50 y, con `antesDe` (el marcador que devolvió la página anterior), los anteriores.
  async listarMensajes(chatId: string, padreIdSolicitante?: string, antesDe?: string): Promise<MensajesPaginados> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const desde = antesDe ? leerMarcador(antesDe) : undefined;
    // Uno de más para saber si hay una página anterior.
    const filas = await this.chatRepo.findPaginaDeMensajes(chat.id, { antesDe: desde, limite: MENSAJES_POR_PAGINA + 1 });
    const hayMas = filas.length > MENSAJES_POR_PAGINA;
    const mensajes = filas.slice(0, MENSAJES_POR_PAGINA).reverse();
    const nombresPorEmisor = new Map<string, string>();
    const enriquecidos: MensajeConEmisor[] = [];
    for (const m of mensajes) {
      if (!nombresPorEmisor.has(m.emisorId)) {
        const emisor = await this.usuarioRepo.findById(m.emisorId);
        nombresPorEmisor.set(m.emisorId, emisor?.nombre ?? "Instituto");
      }
      enriquecidos.push({ ...m, emisorNombre: nombresPorEmisor.get(m.emisorId)! });
    }
    return { mensajes: enriquecidos, anteriores: hayMas ? marcador(mensajes[0]) : null };
  }

  async enviarMensaje(
    chatId: string,
    texto: string,
    emisorId: string,
    rolEmisor: RolEmisorMensaje,
    padreIdSolicitante?: string,
  ): Promise<Mensaje> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    const mensaje: Mensaje = { id: randomUUID(), chatId, emisorId, rolEmisor, texto, fecha: new Date(), vistoEn: null, editadoEn: null, eliminadoEn: null };
    return this.unitOfWork.runInTransaction(async (tx) => {
      const guardado = await this.chatRepo.agregarMensaje(mensaje, tx);
      await this.anuncios.publicar("chat.mensaje", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
      return guardado;
    });
  }

  // Corrige el texto de un mensaje propio (la familia, el suyo; el instituto, cualquiera del instituto) dentro del plazo.
  // Si el texto no cambia no hace nada. Se anuncia: la otra parte lo ve cambiar y los avisos se ponen al día.
  async editarMensaje(chatId: string, mensajeId: string, texto: string, rol: RolEmisorMensaje, padreIdSolicitante?: string): Promise<void> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const mensaje = await this.mensajeEditable(chatId, mensajeId, rol, tx);
      if (mensaje.texto === texto) return;
      if (!(await this.chatRepo.corregirMensaje(mensajeId, texto, new Date(), tx))) throw new ConflictError("El mensaje ya fue eliminado");
      await this.anuncios.publicar("chat.editado", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
    });
  }

  // Elimina un mensaje propio dentro del plazo: queda "Se eliminó este mensaje" y el texto se borra. Eliminar uno ya
  // eliminado no hace nada.
  async eliminarMensaje(chatId: string, mensajeId: string, rol: RolEmisorMensaje, padreIdSolicitante?: string): Promise<void> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const mensaje = await this.chatRepo.findMensajeById(mensajeId, tx);
      if (mensaje?.chatId === chatId && mensaje.eliminadoEn) return;
      await this.mensajeEditable(chatId, mensajeId, rol, tx);
      if (await this.chatRepo.eliminarMensaje(mensajeId, new Date(), tx)) {
        await this.anuncios.publicar("chat.eliminado", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
      }
    });
  }

  // El mensaje, si quien pide puede tocarlo: es de esa conversación, es de su lado, no fue eliminado y está en plazo.
  private async mensajeEditable(chatId: string, mensajeId: string, rol: RolEmisorMensaje, tx: unknown): Promise<Mensaje> {
    const mensaje = await this.chatRepo.findMensajeById(mensajeId, tx);
    if (!mensaje || mensaje.chatId !== chatId) throw new EntityNotFoundError("Mensaje", mensajeId);
    if ((mensaje.rolEmisor === "padre") !== (rol === "padre")) {
      throw new AuthorizationError("Solo se pueden corregir o eliminar los mensajes de tu lado de la conversación");
    }
    if (mensaje.eliminadoEn) throw new ConflictError("El mensaje ya fue eliminado");
    if (Date.now() - mensaje.fecha.getTime() > MINUTOS_PARA_CORREGIR * 60_000) {
      throw new ConflictError(`Pasaron más de ${MINUTOS_PARA_CORREGIR} minutos desde que se envió el mensaje`);
    }
    return mensaje;
  }

  // Marca leídos los mensajes del otro lado: los que quien lee tenía en pantalla (`alcance`; sin él, todos). Si no había
  // nada sin ver, no hace nada (ni anuncia).
  async marcarLeido(chatId: string, lector: Lector, padreIdSolicitante?: string, alcance?: AlcanceLectura): Promise<void> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const usuarioIdPadre = await this.cuentaDelPadre(chat.padreId);
    await this.unitOfWork.runInTransaction(async (tx) => {
      const marcados = await this.chatRepo.marcarVistos(chatId, lector, new Date(), alcance, tx);
      if (marcados > 0) await this.anuncios.publicar("chat.leido", { chatId, padreId: chat.padreId, usuarioIdPadre }, tx);
    });
  }

  // El número del menú: conversaciones con mensajes de familias sin ver (instituto) o mensajes del instituto sin ver (padre).
  async noLeidos(lector: Lector, padreId?: string): Promise<{ conversaciones: number } | { mensajes: number }> {
    if (lector === "instituto") return { conversaciones: await this.chatRepo.contarConversacionesConNoVistos() };
    const chat = padreId ? await this.chatRepo.findByPadreId(padreId) : null;
    return { mensajes: chat ? await this.chatRepo.contarNoVistos(chat.id, "familia") : 0 };
  }

  // Una conversación por familia: si dos pedidos la crean a la vez, el segundo choca con la clave única (su transacción
  // se deshace, sin anunciar nada) y se queda con la que creó el primero. Crearla se anuncia: aparece en la lista del
  // resto del instituto.
  private async obtenerOCrear(padreId: string): Promise<Chat> {
    const existente = await this.chatRepo.findByPadreId(padreId);
    if (existente) return existente;
    try {
      return await this.unitOfWork.runInTransaction(async (tx) => {
        const chat = await this.chatRepo.create({ id: randomUUID(), padreId, creadoEn: new Date() }, tx);
        await this.anuncios.publicar("chat.creada", { chatId: chat.id, padreId }, tx);
        return chat;
      });
    } catch (error) {
      const creada = await this.chatRepo.findByPadreId(padreId);
      if (creada) return creada;
      throw error;
    }
  }

  private async cuentaDelPadre(padreId: string): Promise<string | null> {
    return (await this.padreRepo.findById(padreId))?.usuarioId ?? null;
  }

  private async verificarAccesoAlChat(chatId: string, padreIdSolicitante?: string): Promise<Chat> {
    const chat = await this.chatRepo.findById(chatId);
    if (!chat) {
      throw new EntityNotFoundError("Chat", chatId);
    }
    if (padreIdSolicitante !== undefined && chat.padreId !== padreIdSolicitante) {
      throw new AuthorizationError("Un padre solo puede acceder a su propia conversación");
    }
    return chat;
  }
}
