import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useMarcarLeido() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.marcarLeido,
    onSettled: (_r, _e, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      void queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
    },
  });
}
