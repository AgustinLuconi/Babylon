import type { Repository } from "../../core/ports";
import type { Chat, ResumenChat } from "./chat.entity";
import type { Lector, Mensaje } from "./mensaje.entity";

export interface ChatRepository extends Repository<Chat> {
  findByPadreId(padreId: string, tx?: unknown): Promise<Chat | null>;
  agregarMensaje(mensaje: Mensaje, tx?: unknown): Promise<Mensaje>;
  findMensajesByChatId(chatId: string, tx?: unknown): Promise<Mensaje[]>;
  // Marca vistos (con `ahora`) los mensajes del otro lado que el lector todavía no vio, solo hasta `hasta` (el último
  // que tenía en pantalla), así uno que llegó en ese mismo instante no queda leído sin verse. Devuelve cuántos marcó.
  marcarVistos(chatId: string, lector: Lector, ahora: Date, hasta?: Date, tx?: unknown): Promise<number>;
  contarNoVistos(chatId: string, lector: Lector, tx?: unknown): Promise<number>;
  // Conversaciones con mensajes de la familia sin ver (el número del menú del instituto).
  contarConversacionesConNoVistos(tx?: unknown): Promise<number>;
  // Para la lista del instituto: por el último mensaje, las que no tienen mensajes al final.
  findResumenes(tx?: unknown): Promise<ResumenChat[]>;
}
