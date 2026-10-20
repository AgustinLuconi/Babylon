import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useMarcarLeido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.marcarLeido,
    // Corre sola (al mirar la conversación): no cuenta como "guardar" para el aviso de versión nueva.
    meta: { segundoPlano: true },
    onSettled: (_r, _e, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
    },
  });
}
