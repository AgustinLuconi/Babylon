import { randomUUID } from "node:crypto";
import { AuthorizationError, EntityNotFoundError } from "../../core/errors";
import type { ChatRepository } from "./chat.repository";
import type { Chat } from "./chat.entity";
import type { Mensaje, RolEmisorMensaje } from "./mensaje.entity";

export class ChatService {
  constructor(private readonly chatRepo: ChatRepository) {}

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

  async listarMensajes(chatId: string, padreIdSolicitante?: string): Promise<Mensaje[]> {
    const chat = await this.verificarAccesoAlChat(chatId, padreIdSolicitante);
    return this.chatRepo.findMensajesByChatId(chat.id);
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
