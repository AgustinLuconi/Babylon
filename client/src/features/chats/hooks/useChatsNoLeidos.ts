import { useQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

// El número del menú lateral; se actualiza con la señal en vivo `chat` (core/tiempoReal).
export function useChatsNoLeidos(habilitado: boolean) {
  return useQuery({ queryKey: ["chats", "no-leidos"], queryFn: chatService.noLeidos, enabled: habilitado });
}
