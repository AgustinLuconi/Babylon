import { useQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

export function useMiChat() {
  return useQuery({
    queryKey: ["chats", "mio"],
    queryFn: chatService.miChat,
  });
}
