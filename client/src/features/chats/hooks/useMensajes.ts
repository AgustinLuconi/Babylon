import { useQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useMensajes(chatId: string | undefined) {
  return useQuery({
    queryKey: ["mensajes", chatId],
    queryFn: () => chatService.listarMensajes(chatId as string),
    enabled: chatId !== undefined,
  });
}
