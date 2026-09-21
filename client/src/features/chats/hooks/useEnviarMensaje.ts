import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useEnviarMensaje(chatId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (texto: string) => chatService.enviarMensaje(chatId as string, { texto }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
    },
  });
}
