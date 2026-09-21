import type { Repository } from "../../core/ports";
import type { Chat } from "./chat.entity";
import type { Mensaje } from "./mensaje.entity";

export interface ChatRepository extends Repository<Chat> {
  findByPadreId(padreId: string, tx?: unknown): Promise<Chat | null>;
  agregarMensaje(mensaje: Mensaje, tx?: unknown): Promise<Mensaje>;
  findMensajesByChatId(chatId: string, tx?: unknown): Promise<Mensaje[]>;
}
