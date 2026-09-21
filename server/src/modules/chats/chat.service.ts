import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError } from "../../core/errors";
import type { ChatRepository } from "./chat.repository";
import type { Chat } from "./chat.entity";
import type { UsuarioRepository } from "../usuarios/usuario.repository";
import type { Mensaje, RolEmisorMensaje } from "./mensaje.entity";

export interface MensajeConEmisor extends Mensaje {
  emisorNombre: string;
}

export class ChatService {
  constructor(
    private readonly chatRepo: ChatRepository,
    private readonly usuarioRepo: UsuarioRepository,
  ) {}

  async listarChats(): Promise<Chat[]> {
    return this.chatRepo.findAll();
  }

  async obtenerOCrearChatDePadre(padreId: string): Promise<Chat> {
    const existente = await this.chatRepo.findByPadreId(padreId);
    if (existente) {
      return existente;
    }
    return this.chatRepo.create({ id: randomUUID(), padreId, creadoEn: new Date() });
  }

  // Devuelve cada mensaje con el nombre de quien lo escribió (no solo su rol),
  // para mostrarle al padre "Secretaría — Lucía Peralta" en vez de un rol pelado.
  async listarMensajes(chatId: string, padreIdSolicitante?: string): Promise<MensajeConEmisor[]> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    const mensajes = await this.chatRepo.findMensajesByChatId(chat.id);
    const nombresPorEmisor = new Map<string, string>();
    const enriquecidos: MensajeConEmisor[] = [];
    for (const m of mensajes) {
      if (!nombresPorEmisor.has(m.emisorId)) {
        const emisor = await this.usuarioRepo.findById(m.emisorId);
        nombresPorEmisor.set(m.emisorId, emisor?.nombre ?? "Instituto");
      }
      enriquecidos.push({ ...m, emisorNombre: nombresPorEmisor.get(m.emisorId)! });
    }
    return enriquecidos;
  }

  async enviarMensaje(
    chatId: string,
    texto: string,
    emisorId: string,
    rolEmisor: RolEmisorMensaje,
    padreIdSolicitante?: string,
  ): Promise<Mensaje> {
    await this.verificarAccesoAlChat(chatId, padreIdSolicitante);

    const mensaje: Mensaje = {
      id: randomUUID(),
      chatId,
      emisorId,
      rolEmisor,
      texto,
      fecha: new Date(),
    };
    return this.chatRepo.agregarMensaje(mensaje);
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
