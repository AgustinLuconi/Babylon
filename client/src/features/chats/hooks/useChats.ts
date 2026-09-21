import { useQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useChats() {
  return useQuery({
    queryKey: ["chats", "todos"],
    queryFn: chatService.listarTodos,
  });
}
