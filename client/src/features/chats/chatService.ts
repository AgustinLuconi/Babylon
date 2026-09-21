import { apiClient } from "@/core/lib/apiClient";
import type { Chat, EnviarMensajeInput, Mensaje } from "./types";

export const chatService = {
  listarTodos: () => apiClient.get<Chat[]>("/api/chats"),
  miChat: () => apiClient.get<Chat>("/api/chats/mio"),
  listarMensajes: (chatId: string) => apiClient.get<Mensaje[]>(`/api/chats/${chatId}/mensajes`),
  enviarMensaje: (chatId: string, datos: EnviarMensajeInput) =>
    apiClient.post<Mensaje>(`/api/chats/${chatId}/mensajes`, datos),
};
