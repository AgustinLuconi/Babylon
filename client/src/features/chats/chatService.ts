import { apiClient } from "@/core/lib/apiClient";
import type { ChatConNoLeidos, ConversacionIniciada, EnviarMensajeInput, Mensaje, NoLeidosChat, ResumenChat } from "./types";

export const chatService = {
  listarResumenes: () => apiClient.get<ResumenChat[]>("/api/chats"),
  miChat: () => apiClient.get<ChatConNoLeidos>("/api/chats/mio"),
  noLeidos: () => apiClient.get<NoLeidosChat>("/api/chats/no-leidos"),
  iniciar: (padreId: string) => apiClient.post<ConversacionIniciada>("/api/chats", { padreId }),
  listarMensajes: (chatId: string) => apiClient.get<Mensaje[]>(`/api/chats/${chatId}/mensajes`),
  enviarMensaje: (chatId: string, datos: EnviarMensajeInput) => apiClient.post<Mensaje>(`/api/chats/${chatId}/mensajes`, datos),
  // `hasta`: la fecha del último mensaje en pantalla; lo que llegó después no se marca.
  marcarLeido: ({ chatId, hasta }: { chatId: string; hasta: string }) => apiClient.post<void>(`/api/chats/${chatId}/leido`, { hasta }),
};
