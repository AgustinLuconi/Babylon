import type { Repository } from "../../core/ports";
import type { Chat, ResumenChat } from "./chat.entity";
import type { AlcanceLectura, Lector, Mensaje, PaginaDeMensajes } from "./mensaje.entity";

export interface ChatRepository extends Repository<Chat> {
  findByPadreId(padreId: string, tx?: unknown): Promise<Chat | null>;
  agregarMensaje(mensaje: Mensaje, tx?: unknown): Promise<Mensaje>;
  // Los mensajes de una página, del más reciente al más viejo (por fecha e id).
  findPaginaDeMensajes(chatId: string, pagina: PaginaDeMensajes, tx?: unknown): Promise<Mensaje[]>;
  // Marca vistos (con `ahora`) los mensajes del otro lado que el lector todavía no vio: todos o, con `alcance`, solo los
  // que tenía en pantalla y los anteriores a lo cargado. Devuelve cuántos marcó.
  marcarVistos(chatId: string, lector: Lector, ahora: Date, alcance?: AlcanceLectura, tx?: unknown): Promise<number>;
  contarNoVistos(chatId: string, lector: Lector, tx?: unknown): Promise<number>;
  // Conversaciones con mensajes de la familia sin ver (el número del menú del instituto).
  contarConversacionesConNoVistos(tx?: unknown): Promise<number>;
  // Para la lista del instituto: por el último mensaje, las que no tienen mensajes al final.
  findResumenes(tx?: unknown): Promise<ResumenChat[]>;
}
