import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useIniciarConversacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatService.iniciar,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["chats"] }),
  });
}
