import { apiClient } from "@/core/lib/apiClient";
import type { ChatConNoLeidos, ConversacionIniciada, EnviarMensajeInput, Mensaje, MensajesPaginados, NoLeidosChat, ResumenChat } from "./types";

export const chatService = {
  listarResumenes: () => apiClient.get<ResumenChat[]>("/api/chats"),
  miChat: () => apiClient.get<ChatConNoLeidos>("/api/chats/mio"),
  noLeidos: () => apiClient.get<NoLeidosChat>("/api/chats/no-leidos"),
  iniciar: (padreId: string) => apiClient.post<ConversacionIniciada>("/api/chats", { padreId }),
  // Los últimos 50 o, con `antesDe` (el marcador de la página anterior), los anteriores.
  listarMensajes: (chatId: string, antesDe?: string) =>
    apiClient.get<MensajesPaginados>(`/api/chats/${chatId}/mensajes${antesDe ? `?${new URLSearchParams({ antesDe })}` : ""}`),
  enviarMensaje: (chatId: string, datos: EnviarMensajeInput) => apiClient.post<Mensaje>(`/api/chats/${chatId}/mensajes`, datos),
  // Lo que había en pantalla: los ids de los mensajes sin ver y, si hay páginas anteriores sin cargar, la fecha del más
  // viejo cargado (lo anterior también queda leído). Lo que llegó después no se marca.
  marcarLeido: ({ chatId, ids, antesDe }: { chatId: string; ids: string[]; antesDe?: string }) =>
    apiClient.post<void>(`/api/chats/${chatId}/leido`, { ids, antesDe }),
};
