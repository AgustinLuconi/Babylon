import { useMutation, useQueryClient } from "@tanstack/react-query";
import { chatService } from "../chatService";

// Corregir o eliminar un mensaje propio: la conversación y la lista se vuelven a pedir.
export function useCorregirMensaje(chatId: string | undefined) {
  const queryClient = useQueryClient();
  const alTerminar = () => {
    void queryClient.invalidateQueries({ queryKey: ["mensajes", chatId] });
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
  };
  const editar = useMutation({
    mutationFn: (datos: { mensajeId: string; texto: string }) => chatService.editarMensaje({ chatId: chatId as string, ...datos }),
    onSuccess: alTerminar,
  });
  const eliminar = useMutation({
    mutationFn: (mensajeId: string) => chatService.eliminarMensaje({ chatId: chatId as string, mensajeId }),
    onSuccess: alTerminar,
  });
  return { editar, eliminar };
}
